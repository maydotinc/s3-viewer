import { Router } from "express";
import { connectRouter } from "./connect";
import { serverInvitesRouter } from "./invites";
import { membersRouter } from "./members";
import { serverCrudRouter } from "./servers";

const serversRouter: Router = Router();

serversRouter.use(connectRouter);
serversRouter.use(serverCrudRouter);
serversRouter.use(membersRouter);
serversRouter.use(serverInvitesRouter);

export { serversRouter };
