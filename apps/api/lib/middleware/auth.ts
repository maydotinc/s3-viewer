import { auth } from "@s3-viewer/auth";
import { fromNodeHeaders } from "better-auth/node";
import { NextFunction, Request, Response } from "express";

const authGuard = (req: Request, res: Response, next: NextFunction) => {
   auth.api
      .getSession({
         headers: fromNodeHeaders(req.headers),
      })
      .then((session) => {
         if (!session) {
            return res.status(401).json({
               message: "Unauthorized, please login to continue",
            });
         }
         req.user = session.user;
         next();
      })
      .catch((error) => {
         console.log("Auth error:", error);
         res.status(401).json({
            message: "Invalid session",
         });
      });
};

const requireUser = (req: Request, res: Response, next: NextFunction) => {
   if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
   }
   next();
};

export { authGuard, requireUser };
