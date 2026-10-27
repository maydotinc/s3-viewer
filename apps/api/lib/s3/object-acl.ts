import {
   GetObjectAclCommand,
   type CopyObjectCommandInput,
   type GetObjectAclCommandOutput,
} from "@aws-sdk/client-s3";
import type { S3Scope } from "./listing";
import { StorageError } from "./errors";

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
      throw new StorageError(
         "conflict",
         "The object's owner could not be preserved."
      );
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
         throw new StorageError(
            "conflict",
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

const readObjectAcl = (
   { client, bucket, signal }: S3Scope,
   key: string
): Promise<GetObjectAclCommandOutput> =>
   client.send(new GetObjectAclCommand({ Bucket: bucket, Key: key }), {
      abortSignal: signal,
   });

export { aclAttributes, readObjectAcl };
