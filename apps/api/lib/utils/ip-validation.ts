import { Session } from "better-auth";
import { Request } from "express";

const isSessionIpValid = (session: Session, req: Request): boolean => {
   if (!session.ipAddress) return true;
   return session.ipAddress === req.ip;
};

export default isSessionIpValid;
