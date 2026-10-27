import type { RequestHandler } from "express";

const privateNoStore: RequestHandler = (_req, res, next) => {
   res.setHeader("Cache-Control", "private, no-store");
   next();
};

export { privateNoStore };
