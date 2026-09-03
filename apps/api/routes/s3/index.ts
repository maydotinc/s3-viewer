import { Router } from "express";
import { bucketsRouter } from "./buckets";
import { objectsRouter } from "./objects";

const s3Router = Router({ mergeParams: true });

s3Router.use("/", bucketsRouter);
s3Router.use("/:bucketName/objects", objectsRouter);

export { s3Router };
