import { Router } from "express";
import { archiveRouter } from "./archive";
import { bucketsRouter } from "./buckets";
import { contentRouter } from "./content";
import { multipartRouter } from "./multipart";
import { objectsRouter } from "./objects";
import { settingsRouter } from "./settings";

const s3Router = Router({ mergeParams: true });

s3Router.use("/", bucketsRouter);
s3Router.use("/:bucketName/objects", settingsRouter);
s3Router.use("/:bucketName/objects", contentRouter);
s3Router.use("/:bucketName/objects", archiveRouter);
s3Router.use("/:bucketName/objects", multipartRouter);
s3Router.use("/:bucketName/objects", objectsRouter);

export { s3Router };
