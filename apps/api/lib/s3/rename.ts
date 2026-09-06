import { ApiHttpError } from "@/lib/http";
import {
   DeleteObjectCommand,
   GetBucketOwnershipControlsCommand,
   GetObjectAclCommand,
   GetObjectTaggingCommand,
   HeadObjectCommand,
   type CopyObjectCommandInput,
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
import { aclAttributes } from "./object-acl";
import { readObjectLockSnapshot } from "./object-lock";
import { copyForRename, copiedMetadata } from "./rename-copy";

const sourceState = ({ $metadata, ...head }: HeadObjectCommandOutput) => {
   void $metadata;
   return head;
};

const renameObject = async (
   { client, bucket, signal }: S3Scope,
   objectKey: string,
   newObjectKey: string,
   expectedETag: string
): Promise<void> => {
   if (!observedETagSchema.safeParse(expectedETag).success)
      throw new ApiHttpError(
         409,
         "Refresh and review the object before renaming it."
      );
   if (objectKey === newObjectKey)
      throw new ApiHttpError(409, "The destination already exists.");
   const provider = await clientProvider(client);
   if (provider !== Provider.S3)
      throw new ApiHttpError(
         409,
         "Rename is unavailable because this provider cannot safely remove the original if it changes during the operation. No objects were changed."
      );
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
   if (source.ETag !== expectedETag)
      throw new ApiHttpError(
         409,
         "The object changed since you reviewed it. Refresh and review it before renaming."
      );
   if (
      source.SSECustomerAlgorithm ||
      (source.ServerSideEncryption && source.ServerSideEncryption !== "AES256")
   )
      throw new ApiHttpError(
         409,
         "Rename is unavailable because this object's encryption settings cannot be fully read and preserved. No objects were changed."
      );
   const sourceIdentity = {
      Bucket: bucket,
      Key: objectKey,
      ...(source.VersionId && { VersionId: source.VersionId }),
   };
   const lock = await readObjectLockSnapshot(
      { client, bucket, signal },
      sourceIdentity
   );
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
   const tagging = await client
      .send(new GetObjectTaggingCommand(sourceIdentity), options)
      .catch(throwHttpError);
   if (!Array.isArray(tagging.TagSet))
      throw new ApiHttpError(502, "The object's tags could not be verified.");
   const tags = tagging.TagSet;
   const once = withoutRetries(client);
   const copied = await copyForRename(
      { client, bucket, signal },
      provider,
      {
         ...source,
         ObjectLockMode: lock.attributes.ObjectLockMode,
         ObjectLockRetainUntilDate: lock.attributes.ObjectLockRetainUntilDate,
         ObjectLockLegalHoldStatus: lock.attributes.ObjectLockLegalHoldStatus,
      },
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
      const normalizeTags = (values: typeof tags) =>
         [...values].sort((a, b) => (a.Key ?? "").localeCompare(b.Key ?? ""));
      for (const key of [newObjectKey, objectKey]) {
         const currentTags = await client.send(
            new GetObjectTaggingCommand({ Bucket: bucket, Key: key }),
            options
         );
         if (
            !Array.isArray(currentTags.TagSet) ||
            !isDeepStrictEqual(
               normalizeTags(tags),
               normalizeTags(currentTags.TagSet)
            )
         )
            throw new Error("Object tags changed");
      }
      for (const identity of [
         {
            Key: newObjectKey,
            ...(copied.VersionId && { VersionId: copied.VersionId }),
         },
         sourceIdentity,
      ]) {
         const currentLock = await readObjectLockSnapshot(
            { client, bucket, signal },
            identity
         );
         if (!isDeepStrictEqual(lock, currentLock))
            throw new Error("Object retention or legal hold changed");
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
            IfMatch: source.ETag,
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
