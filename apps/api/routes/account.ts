import { asyncHandler } from "@/lib/http";
import { requireUser } from "@/lib/middleware/authorize";
import { accountSummary } from "@/lib/services/account";
import { Router, type Request, type Response } from "express";

const accountRouter: Router = Router();

const getSummary = async (req: Request, res: Response) => {
   res.json(await accountSummary(requireUser(req)));
};

accountRouter.get("/summary", asyncHandler(getSummary));

export { accountRouter };
