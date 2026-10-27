import { Router } from "express";
import { auditRouter } from "./audit";
import { connectRouter } from "./connect";
import { credentialsRouter } from "./credentials";
import { serverInvitesRouter } from "./invites";
import { membersRouter } from "./members";
import { serverCrudRouter } from "./servers";
import { transfersRouter } from "./transfers";

const serversRouter: Router = Router();

serversRouter.use(connectRouter);
serversRouter.use(serverCrudRouter);
serversRouter.use(credentialsRouter);
serversRouter.use(membersRouter);
serversRouter.use(serverInvitesRouter);
serversRouter.use(auditRouter);
serversRouter.use(transfersRouter);

export { serversRouter };
