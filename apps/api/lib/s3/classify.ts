import { ErrorCode } from "@s3-viewer/types";

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

const classifyFailure = (failure: FailureShape): HttpFailure => {
   const { name, httpStatus } = failure;
   if (name === "NoSuchBucket") return BUCKET_NOT_FOUND;
   if (NOT_FOUND_NAMES.has(name) || httpStatus === 404) return OBJECT_NOT_FOUND;
   if (REJECTED_CREDENTIAL_NAMES.has(name)) return CREDENTIALS_REJECTED;
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

/**
 * ListBuckets is the one call a server without an allowed-bucket list relies
 * on, so a 403 there means the credentials are the problem, not one bucket.
 * ListObjectsV2 is deliberately excluded: prefix-scoped IAM is legitimate.
 */
const classifyListBucketsError = (
   err: unknown
): HttpFailure & { name: string } => {
   const classified = classifyS3Error(err);
   return classified.status === 403
      ? { ...CREDENTIALS_REJECTED, name: classified.name }
      : classified;
};

const deleteFailureMessage = (code: string | undefined): string =>
   classifyFailure({ name: code ?? "Unknown", detail: "" }).message;

export { classifyListBucketsError, classifyS3Error, deleteFailureMessage };
