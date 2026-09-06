import { ApiHttpError } from "@/lib/http";
import type { S3Scope } from "./listing";

// S3 copy/delete is not a transaction across two keys. Versioning can retain
// bytes, but neither ETags nor an additional HEAD can protect concurrent ACL or
// tag-based permission revocation. Keep this endpoint as a non-mutating refusal
// until the provider can enforce all of those guarantees in one operation.
const renameUnavailableError = () =>
   new ApiHttpError(
      409,
      "Rename is unavailable because copying and deleting cannot safely preserve concurrent data and permission changes. No objects were changed. Download and upload under a new filename instead."
   );

const renameObject = async (
   _scope: S3Scope,
   _objectKey: string,
   _newObjectKey: string,
   _expectedETag: string
): Promise<never> => {
   throw renameUnavailableError();
};

export { renameObject, renameUnavailableError };
