import { Router } from "express";
import inviteRouter from "./invites";
import manageRouter from "./manage";
import retrieveRouter from "./retrieve";

const serverRouter: Router = Router();

serverRouter.use("/manage", manageRouter);
serverRouter.use("/invites", inviteRouter);
serverRouter.use("/retrieve", retrieveRouter);

export default serverRouter;
