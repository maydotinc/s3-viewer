import type { Response } from "express";
import { ApiHttpError } from "../http";
import { getAuth } from "./authorize";

const requireExpectedUser = (res: Response, expectedUserId: string): string => {
   const { userId } = getAuth(res);
   if (expectedUserId !== userId) {
      throw new ApiHttpError(
         403,
         "The signed-in account changed. Close this dialog and try again."
      );
   }
   return userId;
};

export { requireExpectedUser };
