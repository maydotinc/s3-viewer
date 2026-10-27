import { siteOrigin } from "@/lib/env";
import { fail } from "@/lib/http";
import { ErrorCode } from "@s3-viewer/shared";
import type { Request, RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const isSameSite = (req: Request): boolean => {
   const origin = req.get("origin");
   return origin
      ? origin === siteOrigin
      : req.get("sec-fetch-site") === "same-origin";
};

// audited GETs need origin checks too: cross-site images can otherwise forge audit entries.
const strictOriginCheck: RequestHandler = (req, res, next) => {
   if (!isSameSite(req)) {
      fail(res, 403, "Cross-site request blocked", ErrorCode.ORIGIN);
      return;
   }
   next();
};

const originCheck: RequestHandler = (req, res, next) =>
   SAFE_METHODS.has(req.method) ? next() : strictOriginCheck(req, res, next);

export { isSameSite, originCheck, strictOriginCheck };
