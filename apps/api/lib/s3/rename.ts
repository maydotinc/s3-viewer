import { ApiHttpError } from "@/lib/http";
import {
   DeleteObjectCommand,
   GetBucketOwnershipControlsCommand,
   GetObjectAclCommand,
   GetObjectTaggingCommand,
   HeadObjectCommand,
   S3ServiceException,
   type CopyObjectCommandInput,
   type GetObjectAclCommandOutput,
   type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import {
   MAX_RENAME_BYTES,
   Provider,
   observedETagSchema,
} from "@s3-viewer/types";
import { isDeepStrictEqual } from "node:util";
import { clientProvider } from "./provider";
import { isNotFound, throwHttpError } from "./errors";
import type { S3Scope } from "./listing";
import { withoutRetries } from "./no-retry";
import { copyForRename, copiedMetadata } from "./rename-copy";

const grantFields = {
   FULL_CONTROL: "GrantFullControl",
   READ: "GrantRead",
   READ_ACP: "GrantReadACP",
   WRITE_ACP: "GrantWriteACP",
} as const;

const aclAttributes = (
   acl: GetObjectAclCommandOutput
): Partial<CopyObjectCommandInput> => {
   if (
      !acl.Owner?.ID ||
      !/^[a-f\d]{64}$/i.test(acl.Owner.ID) ||
      !acl.Grants?.length
   )
      throw new ApiHttpError(409, "The object's owner could not be preserved.");
   const fields: Record<string, Set<string>> = {
      GrantFullControl: new Set([`id="${acl.Owner.ID}"`]),
   };
   for (const { Grantee: grantee, Permission: permission } of acl.Grants ??
      []) {
      const field =
         permission && grantFields[permission as keyof typeof grantFields];
      const value =
         grantee?.Type === "CanonicalUser" &&
         /^[a-f\d]{64}$/i.test(grantee.ID ?? "")
            ? `id="${grantee.ID}"`
            : grantee?.Type === "Group" &&
                /^https?:\/\/acs\.amazonaws\.com\/groups\/[a-z\d/_-]+$/i.test(
                   grantee.URI ?? ""
                )
              ? `uri="${grantee.URI}"`
              : null;
      if (!field || !value)
         throw new ApiHttpError(
            409,
            "The object's access permissions could not be preserved."
         );
      (fields[field] ??= new Set()).add(value);
   }
   return Object.fromEntries(
      Object.entries(fields).map(([field, values]) => [
         field,
         [...values].sort().join(", "),
      ])
   );
};

const sourceState = ({ $metadata, ...head }: HeadObjectCommandOutput) => {
   void $metadata;
   return head;
};

const renameObject = async (
   { client, bucket, signal }: S3Scope,
   objectKey: string,
   newObjectKey: string
): Promise<void> => {
   if (objectKey === newObjectKey)
      throw new ApiHttpError(409, "The destination already exists.");
   const provider = await clientProvider(client);
   const options = { abortSignal: signal };
   const source = await client
      .send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }), options)
      .catch(throwHttpError);
   if (source.ContentLength === undefined || source.ContentLength < 0)
      throw new ApiHttpError(409, "The object's size could not be verified.");
   if (source.ContentLength > MAX_RENAME_BYTES)
      throw new ApiHttpError(413, "Objects over 5 GB can't be renamed");
   if (!observedETagSchema.safeParse(source.ETag).success)
      throw new ApiHttpError(
         409,
         "The object has no ETag, so it can't be safely renamed"
      );
   const sourceIdentity = {
      Bucket: bucket,
      Key: objectKey,
      ...(source.VersionId && { VersionId: source.VersionId }),
   };
   let acl: Partial<CopyObjectCommandInput> | undefined;
   if (provider === Provider.S3) {
      const ownership = await client
         .send(
            new GetBucketOwnershipControlsCommand({ Bucket: bucket }),
            options
         )
         .catch(() => null);
      if (
         ownership?.OwnershipControls?.Rules?.length !== 1 ||
         ownership.OwnershipControls.Rules[0]?.ObjectOwnership !==
            "BucketOwnerEnforced"
      ) {
         acl = aclAttributes(
            await client
               .send(new GetObjectAclCommand(sourceIdentity), options)
               .catch(throwHttpError)
         );
      }
   }
   const tagging =
      provider === Provider.Other
         ? await client
              .send(new GetObjectTaggingCommand(sourceIdentity), options)
              .catch((error: unknown) => {
                 if (
                    !source.TagCount &&
                    error instanceof S3ServiceException &&
                    ["NotImplemented", "MethodNotAllowed"].includes(
                       error.name
                    ) &&
                    [405, 501].includes(error.$metadata.httpStatusCode ?? 0)
                 )
                    return null;
                 return throwHttpError(error);
              })
         : undefined;
   if (tagging && !Array.isArray(tagging.TagSet))
      throw new ApiHttpError(502, "The object's tags could not be verified.");
   const tags = tagging?.TagSet;
   const once = withoutRetries(client);
   const copied = await copyForRename(
      { client, bucket, signal },
      provider,
      source,
      objectKey,
      newObjectKey,
      acl,
      tags
   ).catch((error: unknown): never => {
      if (
         error instanceof Error &&
         ["PreconditionFailed", "ConditionalRequestConflict"].includes(
            error.name
         )
      )
         throw new ApiHttpError(
            409,
            "The original changed or the destination already exists. Refresh the folder and try again."
         );
      return throwHttpError(error);
   });

   const matchesCopy = (destination: HeadObjectCommandOutput) =>
      observedETagSchema.safeParse(copied.ETag).success &&
      destination.ETag === copied.ETag &&
      (!copied.VersionId || destination.VersionId === copied.VersionId) &&
      destination.ContentLength === source.ContentLength &&
      isDeepStrictEqual(copiedMetadata(source), copiedMetadata(destination));
   let deleteAttempted = false;
   try {
      const destination = await client.send(
         new HeadObjectCommand({ Bucket: bucket, Key: newObjectKey }),
         options
      );
      if (!matchesCopy(destination)) throw new Error("Destination changed");
      if (acl) {
         const currentAcl = await client.send(
            new GetObjectAclCommand({ Bucket: bucket, Key: objectKey }),
            options
         );
         if (!isDeepStrictEqual(acl, aclAttributes(currentAcl)))
            throw new Error("Source permissions changed");
      }
      if (tags) {
         const currentTags = await client.send(
            new GetObjectTaggingCommand({ Bucket: bucket, Key: objectKey }),
            options
         );
         const normalize = (values: typeof tags) =>
            [...values].sort((a, b) =>
               (a.Key ?? "").localeCompare(b.Key ?? "")
            );
         if (
            !isDeepStrictEqual(
               normalize(tags),
               normalize(currentTags.TagSet ?? [])
            )
         )
            throw new Error("Source tags changed");
      }
      const current = await client.send(
         new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
         options
      );
      if (!isDeepStrictEqual(sourceState(source), sourceState(current)))
         throw new Error("Source changed");
      deleteAttempted = true;
      await once.send(
         new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            ...(provider === Provider.S3 && { IfMatch: source.ETag }),
         }),
         options
      );
   } catch {
      const remains = await client
         .send(
            new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
            options
         )
         .then(() => true)
         .catch((error: unknown) => (isNotFound(error) ? false : null));
      if (deleteAttempted && remains === false) {
         const retained = await client
            .send(
               new HeadObjectCommand({ Bucket: bucket, Key: newObjectKey }),
               options
            )
            .then(matchesCopy)
            .catch(() => false);
         if (retained) return;
      }
      throw new ApiHttpError(
         409,
         "The copy was created, but the original could not be safely removed. Refresh the folder and check both files before deleting either one."
      );
   }
};

export { renameObject };
