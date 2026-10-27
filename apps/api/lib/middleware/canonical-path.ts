import { fail } from "@/lib/http";
import type { RequestHandler } from "express";

const AMBIGUOUS = /%2e|%2f|%5c|\\|\/\//i;

// Express routes on the raw path but Better Auth re-parses it with WHATWG URL,
// which collapses dot segments; a path the two read differently skips path-bound limiters.
// an undecodable segment 400s inside the router, after the mount-based limiters picked a bucket from the raw text.
const isCanonical = (rawPath: string): boolean => {
   if (!rawPath.startsWith("/") || AMBIGUOUS.test(rawPath)) return false;
   try {
      decodeURIComponent(rawPath);
      return new URL(rawPath, "http://canonical.invalid").pathname === rawPath;
   } catch {
      return false;
   }
};

const canonicalPath: RequestHandler = (req, res, next) => {
   const [rawPath = ""] = req.originalUrl.split("?", 1);
   if (!isCanonical(rawPath)) {
      fail(res, 400, "Bad request path");
      return;
   }
   next();
};

export { canonicalPath, isCanonical };
