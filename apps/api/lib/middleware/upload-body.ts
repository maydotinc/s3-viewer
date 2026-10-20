import { BUCKETS_PATH, underAnyServer } from "@/lib/constants";
import { MULTIPART_PARTS_PATH, OBJECT_MUTATION_PATH } from "@s3-viewer/types";
import type { Request } from "express";

type UploadRequest = Pick<Request, "method" | "baseUrl" | "path">;

const BUCKET_OBJECTS = `${underAnyServer(BUCKETS_PATH)}/[^/]+/objects`;
const OBJECT_UPLOAD_PATH = new RegExp(
   `${BUCKET_OBJECTS}${OBJECT_MUTATION_PATH}/upload/?$`,
   "i"
);
const PART_UPLOAD_PATH = new RegExp(
   `${BUCKET_OBJECTS}${MULTIPART_PARTS_PATH}/?$`,
   "i"
);

const fullPath = (req: UploadRequest): string => `${req.baseUrl}${req.path}`;

const isObjectUpload = (req: UploadRequest): boolean =>
   req.method === "PUT" && OBJECT_UPLOAD_PATH.test(fullPath(req));

const isPartUploadPath = (req: UploadRequest): boolean =>
   req.method === "PUT" && PART_UPLOAD_PATH.test(fullPath(req));

// part fields live in the query whatever the body claims to be, so a mistyped part
// reaches the route's 415 instead of failing validation on an empty body.
const readsQueryFields = (req: UploadRequest): boolean =>
   isObjectUpload(req) || isPartUploadPath(req);

export { isObjectUpload, readsQueryFields };
