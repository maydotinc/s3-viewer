import { OBJECT_MUTATION_PATH } from "@s3-viewer/types";
import type { Request } from "express";

const OBJECT_UPLOAD_PATH = new RegExp(
   `^/servers/[^/]+/buckets/[^/]+/objects(?:/upload|${OBJECT_MUTATION_PATH}/upload)?/?$`,
   "i"
);

const isObjectUpload = (req: Pick<Request, "method" | "path">): boolean =>
   req.method === "PUT" && OBJECT_UPLOAD_PATH.test(req.path);

export { isObjectUpload };
