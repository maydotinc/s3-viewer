import { siteOrigin } from "@/lib/env";
import { fail } from "@/lib/http";
import { ErrorCode } from "@s3-viewer/types";
import type { RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const originCheck: RequestHandler = (req, res, next) => {
   if (SAFE_METHODS.has(req.method)) {
      next();
      return;
   }
   const origin = req.get("origin");
   const allowed = origin
      ? origin === siteOrigin
      : req.get("sec-fetch-site") === "same-origin";
   if (!allowed) {
      fail(res, 403, "Cross-site request blocked", ErrorCode.ORIGIN);
      return;
   }
   next();
};

export { originCheck };
