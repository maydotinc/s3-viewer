import { logger } from "@/lib/logger";
import type { RequestHandler } from "express";

type TrustFn = (address: string, hop: number) => boolean;

// a proxy TRUST_PROXY does not cover makes every visitor share its address, so per-IP limits throttle them all together.
const untrustedProxyWarning = (): RequestHandler => {
   let warned = false;
   return (req, _res, next) => {
      if (!warned && req.headers["x-forwarded-for"] !== undefined) {
         const peer = req.socket.remoteAddress;
         const trusts = req.app.get("trust proxy fn") as TrustFn;
         if (peer && !trusts(peer, 0)) {
            warned = true;
            logger.warn(
               `[security] ignoring X-Forwarded-For from ${peer}, which TRUST_PROXY does not trust. if that is your proxy, set TRUST_PROXY to its hop count or address, or every visitor shares one per-IP rate limit`
            );
         }
      }
      next();
   };
};

export { untrustedProxyWarning };
