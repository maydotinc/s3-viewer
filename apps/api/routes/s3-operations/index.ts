import { Router } from "express";
import bucketRouter from "./bucket";
import objectRouter from "./object";

const s3Router: Router = Router();
s3Router.use("/bucket", bucketRouter);
s3Router.use("/object", objectRouter);

export default s3Router;
