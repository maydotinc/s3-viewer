type FailureShape = {
   name: string;
   httpStatus?: number;
   detail: string;
};

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

const isConflictCode = (code: unknown): boolean =>
   code === "PreconditionFailed" || code === "ConditionalRequestConflict";

const isConflict = (error: unknown): boolean => {
   const { name, httpStatus } = describeFailure(error);
   return isConflictCode(name) || httpStatus === 412;
};

const FORBIDDEN_NAMES: ReadonlySet<string> = new Set([
   "AccessDenied",
   "Forbidden",
]);

// by name only: a 403 with a credential-rejection code is not a permission problem.
const isForbiddenFailure = ({ name }: FailureShape): boolean =>
   FORBIDDEN_NAMES.has(name);

const isForbidden = (error: unknown): boolean =>
   isForbiddenFailure(describeFailure(error));

type FailedResponse = { statusCode?: number; headers?: Record<string, string> };

const failedResponse = (err: unknown): FailedResponse | undefined =>
   (err as { $response?: FailedResponse } | null | undefined)?.$response;

const bucketRegionHeader = (err: unknown): string | undefined =>
   failedResponse(err)?.headers?.["x-amz-bucket-region"];

export {
   bucketRegionHeader,
   describeFailure,
   failedResponse,
   isConflict,
   isConflictCode,
   isForbidden,
   isForbiddenFailure,
};
export type { FailureShape };
