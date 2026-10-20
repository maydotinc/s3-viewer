import { fail } from "@/lib/http";
import type { Request, RequestHandler } from "express";
import { SECOND_MS } from "@s3-viewer/types";

const BODY_READ_TIMEOUT_MS = 30 * SECOND_MS;
const deadlines = new WeakMap<Request, () => void>();

const allowStreamingBody = (req: Request): void => {
   deadlines.get(req)?.();
};

const requestBodyGuard =
   (timeoutMs = BODY_READ_TIMEOUT_MS): RequestHandler =>
   (req, res, next) => {
      const hasBody =
         req.headers["transfer-encoding"] !== undefined ||
         Number(req.headers["content-length"] ?? 0) > 0;
      if (!hasBody) {
         next();
         return;
      }

      const socket = req.socket;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const clearDeadline = () => {
         clearTimeout(timer);
         timer = undefined;
         deadlines.delete(req);
      };
      const cleanup = () => {
         clearDeadline();
         req.off("end", cleanup);
         req.off("aborted", cleanup);
         res.off("finish", onFinish);
         res.off("close", cleanup);
      };
      const onFinish = () => {
         cleanup();
         if (!req.complete) socket.destroySoon();
      };
      req.once("end", cleanup);
      req.once("aborted", cleanup);
      res.once("finish", onFinish);
      res.once("close", cleanup);

      if (req.method === "GET" || req.method === "HEAD") {
         res.setHeader("Connection", "close");
         fail(res, 400, "GET and HEAD requests must not have a body");
         return;
      }

      deadlines.set(req, clearDeadline);
      timer = setTimeout(() => {
         if (req.complete) {
            cleanup();
            return;
         }
         clearDeadline();
         if (res.headersSent) {
            socket.destroy();
            return;
         }
         res.setHeader("Connection", "close");
         fail(res, 408, "Request body took too long to arrive");
      }, timeoutMs);
      timer.unref();
      next();
   };

export { allowStreamingBody, requestBodyGuard };
