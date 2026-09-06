import { ErrorCode } from "@s3-viewer/types";
import { OBJECT_EXISTS } from "../constants";
import { PRIVATE_ADDRESS_CODE } from "../utils/endpoint";

type HttpFailure = { status: number; message: string; code?: ErrorCode };

type FailureShape = {
   name: string;
   httpStatus?: number;
   detail: string;
};

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
   "ExpiredToken",
   "UnrecognizedClientException",
]);
const FORBIDDEN_NAMES: ReadonlySet<string> = new Set([
   "AccessDenied",
   "Forbidden",
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
const FAILED: HttpFailure = { status: 502, message: "Storage request failed" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
   typeof value === "object" && value !== null;

const stringField = (
   record: Record<string, unknown>,
   key: string
): string | undefined =>
   typeof record[key] === "string" ? record[key] : undefined;

const describeFailure = (err: unknown): FailureShape => {
   if (!isRecord(err)) return { name: "Unknown", detail: "" };
   const meta = isRecord(err.$metadata) ? err.$metadata : {};
   const httpStatus = meta.httpStatusCode;
   return {
      name: stringField(err, "code") ?? stringField(err, "name") ?? "Unknown",
      httpStatus: typeof httpStatus === "number" ? httpStatus : undefined,
      detail: stringField(err, "message") ?? "",
   };
};

const isCopySourceTooLarge = ({ name, detail }: FailureShape): boolean =>
   name === "InvalidRequest" && /copy source/i.test(detail);

type FailureScope = "object" | "bucket";

const classifyFailure = (
   failure: FailureShape,
   scope: FailureScope = "object"
): HttpFailure => {
   const { name, httpStatus } = failure;
   if (name === "NoSuchBucket") return BUCKET_NOT_FOUND;
   if (NOT_FOUND_NAMES.has(name) || httpStatus === 404) {
      // a missing bucket comes back as a bare NotFound/404, so only the caller
      // knows whether a bucket or an object was addressed
      return scope === "bucket" ? BUCKET_NOT_FOUND : OBJECT_NOT_FOUND;
   }
   if (REJECTED_CREDENTIAL_NAMES.has(name)) return CREDENTIALS_REJECTED;
   if (name === "PreconditionFailed") return ALREADY_EXISTS;
   // s3 answers 403 for an archived object, so this precedes the 403 mapping
   if (name === "InvalidObjectState") return ARCHIVED;
   if (FORBIDDEN_NAMES.has(name) || httpStatus === 403) return FORBIDDEN;
   if (name === "EntityTooLarge" || isCopySourceTooLarge(failure))
      return TOO_LARGE;
   if (BAD_REQUEST_NAMES.has(name) || httpStatus === 400) return BAD_REQUEST;
   if (NETWORK_NAMES.has(name)) return UNREACHABLE;
   return FAILED;
};

const classifyS3Error = (err: unknown): HttpFailure & { name: string } => {
   const failure = describeFailure(err);
   return { ...classifyFailure(failure), name: failure.name };
};

const classifyBucketError = (err: unknown): HttpFailure & { name: string } => {
   const failure = describeFailure(err);
   return { ...classifyFailure(failure, "bucket"), name: failure.name };
};

// a 403 from listBuckets means the credentials are the problem, not one bucket.
// listObjectsV2 is excluded on purpose: prefix-scoped iam is legitimate
const classifyListBucketsError = (
   err: unknown
): HttpFailure & { name: string } => {
   const classified = classifyS3Error(err);
   return classified.status === 403
      ? { ...CREDENTIALS_REJECTED, name: classified.name }
      : classified;
};

const deleteFailureMessage = (code: string | undefined): string =>
   code === "PreconditionFailed" || code === "ConditionalRequestConflict"
      ? "The object changed. Refresh and review it before deleting."
      : classifyFailure({ name: code ?? "Unknown", detail: "" }).message;

export {
   classifyBucketError,
   classifyListBucketsError,
   classifyS3Error,
   deleteFailureMessage,
};
