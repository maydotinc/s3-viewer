import {
   describeFailure,
   isForbiddenFailure,
   type FailureShape,
} from "./failure";
import { ErrorCode } from "@s3-viewer/shared";
import { OBJECT_EXISTS } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { PRIVATE_ADDRESS_CODE } from "@/lib/utils/endpoint";
import { StorageError, toHttpFailure, type StorageErrorKind } from "./errors";
import { RESPONSE_TOO_LARGE } from "./xml-response-guard";

type StorageFailure = {
   kind: StorageErrorKind;
   message: string;
   code?: ErrorCode;
};

const NOT_FOUND_NAMES: ReadonlySet<string> = new Set(["NoSuchKey", "NotFound"]);
const REJECTED_CREDENTIAL_NAMES: ReadonlySet<string> = new Set([
   "InvalidAccessKeyId",
   "InvalidClientTokenId",
   "SignatureDoesNotMatch",
   "AuthorizationHeaderMalformed",
   "InvalidToken",
   "UnrecognizedClientException",
]);
const EXPIRED_CREDENTIAL_NAMES: ReadonlySet<string> = new Set([
   "ExpiredToken",
   "ExpiredTokenException",
   "TokenRefreshRequired",
]);
const BAD_REQUEST_NAMES: ReadonlySet<string> = new Set([
   "InvalidBucketName",
   "InvalidArgument",
]);
const NETWORK_NAMES: ReadonlySet<string> = new Set([
   "TimeoutError",
   "AbortError",
   "ENOTFOUND",
   "ECONNREFUSED",
   "ECONNRESET",
   "ETIMEDOUT",
   "EAI_AGAIN",
   "EPIPE",
   "EPROTO",
   "CERT_HAS_EXPIRED",
   "DEPTH_ZERO_SELF_SIGNED_CERT",
   "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
   PRIVATE_ADDRESS_CODE,
]);

const OBJECT_NOT_FOUND: StorageFailure = {
   kind: "notFound",
   message: "Object not found",
};
const UPLOAD_GONE: StorageFailure = {
   kind: "notFound",
   message: "This upload no longer exists. Start it again.",
};
const BUCKET_NOT_FOUND: StorageFailure = {
   kind: "notFound",
   message: "Bucket not found",
};
const CREDENTIALS_REJECTED: StorageFailure = {
   kind: "upstream",
   message: "The server rejected these credentials",
   code: ErrorCode.CREDENTIALS_REJECTED,
};
const CREDENTIALS_EXPIRED: StorageFailure = {
   kind: "upstream",
   message:
      "The temporary credentials expired. Update the access key, secret key and session token.",
   code: ErrorCode.CREDENTIALS_REJECTED,
};
const FORBIDDEN: StorageFailure = {
   kind: "forbidden",
   message: "The server credentials don't allow this",
};
const ARCHIVED: StorageFailure = {
   kind: "conflict",
   message: "Object is archived and must be restored first",
};
const ALREADY_EXISTS: StorageFailure = {
   kind: "conflict",
   message: OBJECT_EXISTS,
};
const TOO_LARGE: StorageFailure = {
   kind: "tooLarge",
   message: "Object is too large for this operation",
};
const BAD_REQUEST: StorageFailure = {
   kind: "invalid",
   message: "Storage rejected the request",
};
const UNREACHABLE: StorageFailure = {
   kind: "upstream",
   message: "Couldn't reach the storage endpoint",
};
const OVERSIZED_RESPONSE: StorageFailure = {
   kind: "upstream",
   message: "Storage sent a response too large to read",
};
const FAILED: StorageFailure = {
   kind: "upstream",
   message: "Storage request failed",
};

const isCopySourceTooLarge = ({ name, detail }: FailureShape): boolean =>
   name === "InvalidRequest" && /copy source/i.test(detail);

type FailureScope = "object" | "bucket" | "bucketList";

const classifyFailure = (
   failure: FailureShape,
   scope: FailureScope = "object"
): StorageFailure => {
   const { name, httpStatus } = failure;
   if (name === "NoSuchBucket") return BUCKET_NOT_FOUND;
   if (name === "NoSuchUpload") return UPLOAD_GONE;
   if (NOT_FOUND_NAMES.has(name) || httpStatus === 404) {
      return scope === "bucket" ? BUCKET_NOT_FOUND : OBJECT_NOT_FOUND;
   }
   if (EXPIRED_CREDENTIAL_NAMES.has(name)) return CREDENTIALS_EXPIRED;
   if (REJECTED_CREDENTIAL_NAMES.has(name)) return CREDENTIALS_REJECTED;
   if (name === "PreconditionFailed") return ALREADY_EXISTS;
   // S3 answers 403 for an archived object, so this precedes the 403 mapping.
   if (name === "InvalidObjectState") return ARCHIVED;
   if (isForbiddenFailure(failure) || httpStatus === 403)
      return scope === "bucketList" ? CREDENTIALS_REJECTED : FORBIDDEN;
   if (name === "EntityTooLarge" || isCopySourceTooLarge(failure))
      return TOO_LARGE;
   if (BAD_REQUEST_NAMES.has(name) || httpStatus === 400) return BAD_REQUEST;
   if (NETWORK_NAMES.has(name)) return UNREACHABLE;
   if (name === RESPONSE_TOO_LARGE) return OVERSIZED_RESPONSE;
   return FAILED;
};

const classifyS3Error = (
   err: unknown,
   scope: FailureScope = "object"
): StorageFailure & { name: string } => {
   const failure = describeFailure(err);
   return { ...classifyFailure(failure, scope), name: failure.name };
};

// an error something above storage already answered (an endpoint refusal, a missing server) passes through.
const storageFailure = (
   err: unknown,
   scope: FailureScope = "object",
   event = "S3 request"
): StorageError | ApiHttpError => {
   if (err instanceof StorageError || err instanceof ApiHttpError) return err;
   const { kind, message, code, name } = classifyS3Error(err, scope);
   const failure = new StorageError(kind, message, code);
   logger.warn(`${event} failed`, {
      s3Error: name,
      kind,
      status: toHttpFailure(failure)?.status,
   });
   return failure;
};

const rethrowFailure =
   (scope?: FailureScope) =>
   (err: unknown): never => {
      throw storageFailure(err, scope);
   };

const isNotFound = (err: unknown): boolean =>
   classifyS3Error(err).kind === "notFound";

export { classifyS3Error, isNotFound, rethrowFailure, storageFailure };
