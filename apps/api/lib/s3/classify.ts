import {
   describeFailure,
   isConflictCode,
   isForbiddenFailure,
   type FailureShape,
} from "./failure";
import { ErrorCode } from "@s3-viewer/types";
import { OBJECT_EXISTS } from "@/lib/constants";
import { PRIVATE_ADDRESS_CODE } from "@/lib/utils/endpoint";
import { RESPONSE_TOO_LARGE } from "./xml-response-guard";

type HttpFailure = { status: number; message: string; code?: ErrorCode };

const NOT_FOUND_NAMES: ReadonlySet<string> = new Set([
   "NoSuchKey",
   "NotFound",
   "NoSuchUpload",
]);
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

const OBJECT_NOT_FOUND: HttpFailure = {
   status: 404,
   message: "Object not found",
};
const BUCKET_NOT_FOUND: HttpFailure = {
   status: 404,
   message: "Bucket not found",
};
const CREDENTIALS_REJECTED: HttpFailure = {
   status: 502,
   message: "The server rejected these credentials",
   code: ErrorCode.CREDENTIALS_REJECTED,
};
const CREDENTIALS_EXPIRED: HttpFailure = {
   status: 502,
   message:
      "The temporary credentials expired. Update the access key, secret key and session token.",
   code: ErrorCode.CREDENTIALS_REJECTED,
};
const FORBIDDEN: HttpFailure = {
   status: 403,
   message: "The server credentials don't allow this",
};
const ARCHIVED: HttpFailure = {
   status: 409,
   message: "Object is archived and must be restored first",
};
const ALREADY_EXISTS: HttpFailure = { status: 409, message: OBJECT_EXISTS };
const TOO_LARGE: HttpFailure = {
   status: 413,
   message: "Object is too large for this operation",
};
const BAD_REQUEST: HttpFailure = {
   status: 400,
   message: "Storage rejected the request",
};
const UNREACHABLE: HttpFailure = {
   status: 502,
   message: "Couldn't reach the storage endpoint",
};
const OVERSIZED_RESPONSE: HttpFailure = {
   status: 502,
   message: "Storage sent a response too large to read",
};
const FAILED: HttpFailure = { status: 502, message: "Storage request failed" };

const isCopySourceTooLarge = ({ name, detail }: FailureShape): boolean =>
   name === "InvalidRequest" && /copy source/i.test(detail);

type FailureScope = "object" | "bucket" | "bucketList";

const classifyFailure = (
   failure: FailureShape,
   scope: FailureScope = "object"
): HttpFailure => {
   const { name, httpStatus } = failure;
   if (name === "NoSuchBucket") return BUCKET_NOT_FOUND;
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
): HttpFailure & { name: string } => {
   const failure = describeFailure(err);
   return { ...classifyFailure(failure, scope), name: failure.name };
};

const deleteFailureMessage = (code: string | undefined): string =>
   isConflictCode(code)
      ? "The object changed. Refresh and review it before deleting."
      : classifyFailure({ name: code ?? "Unknown", detail: "" }).message;

export { classifyS3Error, deleteFailureMessage };
export type { FailureScope };
