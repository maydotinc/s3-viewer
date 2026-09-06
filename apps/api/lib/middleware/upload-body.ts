import type { Request } from "express";

const OBJECT_UPLOAD_PATH =
   /^\/servers\/[^/]+\/buckets\/[^/]+\/objects(?:\/upload)?\/?$/i;

// JSON files are upload data too; neither upload route may consume them with
// express.json before the raw stream reaches the storage handler.
const isObjectUpload = (req: Pick<Request, "method" | "path">): boolean =>
   req.method === "PUT" && OBJECT_UPLOAD_PATH.test(req.path);

export { isObjectUpload };
