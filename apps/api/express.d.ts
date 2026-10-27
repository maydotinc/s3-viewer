import type { SessionRecord, SessionUser } from "@/lib/middleware/auth";
import type { AuditContext, AuthContext } from "@/lib/middleware/authorize";

declare global {
   namespace Express {
      interface Request {
         user?: SessionUser;
         session?: SessionRecord;
      }
      interface Locals {
         requestId?: string;
         input?: unknown;
         auth?: AuthContext;
         audit?: AuditContext;
      }
   }
}
