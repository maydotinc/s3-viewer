import { ApiHttpError } from "@/lib/http";
import { ACCOUNT_CHANGED_MESSAGE, ErrorCode } from "@s3-viewer/shared";
import { getAuth } from "./authorize";
import type { Response } from "express";

const accountChanged = (): ApiHttpError =>
   new ApiHttpError(403, ACCOUNT_CHANGED_MESSAGE, ErrorCode.ACCOUNT_CHANGED);

const requireExpectedUser = (res: Response, expectedUserId: string): void => {
   if (expectedUserId !== getAuth(res).userId) throw accountChanged();
};

export { accountChanged, requireExpectedUser };
