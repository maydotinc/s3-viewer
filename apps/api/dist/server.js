// server.ts
import { auth } from "@s3-viewer/auth";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import dotenv from "dotenv";
import express, { urlencoded } from "express";

// routes/bucket.ts
import { CreateBucketCommand, DeleteBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { Router } from "express";

// lib/s3.ts
import { S3Client } from "@aws-sdk/client-s3";
var s3Config = {
  endpoint: process.env.AWS_ENDPOINT || "http://localhost:9000",
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  },
  forcePathStyle: true
};
var s3Client = new S3Client(s3Config);

// utils/formatBuckets.ts
var formatBuckets = (response) => {
  return response.Buckets.map((bucket) => ({
    Name: bucket.Name,
    CreationDate: bucket.CreationDate
  }));
};
var formatBuckets_default = formatBuckets;

// routes/bucket.ts
var bucketRouter = Router();
bucketRouter.put("/create", async (req, res) => {
  const { bucketName } = req.body;
  const command = new CreateBucketCommand({ Bucket: bucketName });
  try {
    await s3Client.send(command);
    res.status(201).json({ message: `Bucket ${bucketName} created successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
bucketRouter.delete("/delete", async (req, res) => {
  const { bucketName } = req.body;
  const command = new DeleteBucketCommand({ Bucket: bucketName });
  try {
    await s3Client.send(command);
    res.status(200).json({ message: `Bucket ${bucketName} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
bucketRouter.get("/list", async (req, res) => {
  const command = new ListBucketsCommand({});
  try {
    const response = await s3Client.send(command);
    res.status(200).json(formatBuckets_default(response));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var bucket_default = bucketRouter;

// routes/object.ts
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Router as Router2 } from "express";
var objectRouter = Router2();
objectRouter.put("/create", async (req, res) => {
  const { bucketName, objectKey, file, contentType } = req.body;
  const buffer = Buffer.from(file);
  const command = new PutObjectCommand({ Bucket: bucketName, Key: objectKey, Body: buffer, ContentType: contentType });
  try {
    await s3Client.send(command);
    res.status(200).json({ message: `Object ${objectKey} created successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
objectRouter.get("/get", async (req, res) => {
  const { bucketName, objectKey } = req.body;
  const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
  try {
    const response = await s3Client.send(command);
    res.setHeader("Content-Type", response.ContentType || "application/octet-stream");
    if (response.ContentLength) {
      res.setHeader("Content-Length", response.ContentLength);
    }
    res.setHeader("Content-Disposition", `attachment; filename="${objectKey.split("/").pop()}"`);
    if (response.ETag) {
      res.setHeader("ETag", response.ETag);
    }
    if (response.LastModified) {
      res.setHeader("Last-Modified", response.LastModified.toUTCString());
    }
    const stream = response.Body;
    stream.pipe(res);
    return new Promise((resolve) => {
      stream.on("end", resolve);
      stream.on("error", resolve);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
objectRouter.delete("/delete", async (req, res) => {
  const { bucketName, objectKey } = req.body;
  const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey });
  try {
    await s3Client.send(command);
    res.status(200).json({ message: `Object ${objectKey} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
objectRouter.post("/copy", async (req, res) => {
  const { sourceBucket, sourceKey, targetBucket, targetKey } = req.body;
  const command = new CopyObjectCommand({
    Bucket: targetBucket,
    Key: targetKey,
    CopySource: `${sourceBucket}/${sourceKey}`
  });
  try {
    await s3Client.send(command);
    res.status(200).json({ message: `Object ${sourceKey} copied to ${targetBucket}/${targetKey}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
objectRouter.post("/move", async (req, res) => {
  const { sourceBucket, sourceKey, targetBucket, targetKey } = req.body;
  const command = new CopyObjectCommand({
    Bucket: targetBucket,
    Key: targetKey,
    CopySource: `${sourceBucket}/${sourceKey}`
  });
  const deleteCommand = new DeleteObjectCommand({
    Bucket: sourceBucket,
    Key: sourceKey
  });
  try {
    await s3Client.send(command);
    await s3Client.send(deleteCommand);
    res.status(200).json({ message: `Object ${sourceKey} moved to ${targetBucket}/${targetKey}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var object_default = objectRouter;

// server.ts
dotenv.config();
var app = express();
app.disable("x-powered-by");
app.use(urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
app.all("/auth/{*any}", toNodeHandler(auth));
app.use(express.json());
app.use("/bucket", bucket_default);
app.use("/object", object_default);
app.get("/", (req, res) => {
  res.send("Can you see this?");
});
var server = app.listen(process.env.PORT || 3001, () => {
  console.log(`API Server is running on port ${process.env.PORT || 3001}`);
});
var connections = /* @__PURE__ */ new Set();
server.on("connection", (connection) => {
  connections.add(connection);
  connection.on("close", () => {
    connections.delete(connection);
  });
});
["SIGINT", "SIGTERM", "SIGUSR2"].forEach((signal) => {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => {
      console.log("Forcing server close");
      connections.forEach((conn) => conn.destroy());
      process.exit(1);
    }, 5e3);
  });
});
