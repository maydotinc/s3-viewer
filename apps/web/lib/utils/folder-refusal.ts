import { ApiError } from "@/lib/api";
import { ErrorCode } from "@s3-viewer/shared";

const isFolderRefusal = (error: unknown): error is ApiError =>
   error instanceof ApiError && error.code === ErrorCode.FOLDER_ACCESS;

export { isFolderRefusal };
