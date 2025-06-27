import { Router } from "express";
import { authGuard } from "../../lib/middleware/auth.js";
import inviteRouter from "./invites.js";
import manageRouter from "./manage.js";
import retrieveRouter from "./retrieve.js";

const serverRouter: Router = Router();

serverRouter.use(authGuard);
serverRouter.use("/manage", manageRouter);
serverRouter.use("/invites", inviteRouter);
serverRouter.use("/retrieve", retrieveRouter);

export default serverRouter;
