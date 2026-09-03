import { siteOrigin } from "@/lib/env";
import { fail } from "@/lib/http";
import type { RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SAME_SITE = new Set(["same-origin", "same-site"]);

const originCheck: RequestHandler = (req, res, next) => {
   if (SAFE_METHODS.has(req.method)) {
      next();
      return;
   }
   const origin = req.get("origin");
   const allowed = origin
      ? origin === siteOrigin
      : SAME_SITE.has(req.get("sec-fetch-site") ?? "");
   if (!allowed) {
      fail(res, 403, "Cross-site request blocked", "ORIGIN");
      return;
   }
   next();
};

export { originCheck };
