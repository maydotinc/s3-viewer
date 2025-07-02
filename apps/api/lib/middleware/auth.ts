import { auth } from "@s3-viewer/auth";
import { fromNodeHeaders } from "better-auth/node";
import { NextFunction, Request, Response } from "express";

const authGuard = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const session = await auth.api.getSession({
         headers: fromNodeHeaders(req.headers),
      });

      if (!session) {
         res.status(401).json({ error: "Unauthorized" });
         return;
      }

      //=== Maybe dont need this ===//
      // if (!isSessionIpValid(session.session, req)) {
      //    console.warn("Mismatching IP address");
      //    return res.status(401).json({ error: "Unauthorized" });
      // }

      req.user = session.user;
      next();
   } catch (e: any) {
      console.log("Auth error:", e);
      res.status(500).send({ error: "Internal server error" });
   }
};

export default authGuard;
