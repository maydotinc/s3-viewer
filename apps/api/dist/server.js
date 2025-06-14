// server.ts
import { auth as auth2 } from "@s3-viewer/auth";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import dotenv from "dotenv";
import express, { urlencoded } from "express";

// routes/s3-operations/bucket.ts
import { CreateBucketCommand, DeleteBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { Router } from "express";

// lib/s3.ts
import { S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
var getS3Client = async (serverId) => {
  const server2 = await prisma.server.findUnique({
    where: {
      id: serverId
    },
    select: {
      credentials: true
    }
  });
  if (!server2) {
    throw new Error("Server not found");
  }
  const credentials = JSON.parse(server2.credentials);
  console.log(credentials);
  return new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKey,
      secretAccessKey: credentials.secretKey
    },
    forcePathStyle: true
  });
};
var getS3ClientFromCredentials = (serverCredentials) => {
  return new S3Client({
    endpoint: serverCredentials.endpoint,
    region: serverCredentials.region,
    credentials: {
      accessKeyId: serverCredentials.accessKey,
      secretAccessKey: serverCredentials.secretKey
    },
    forcePathStyle: true
  });
};

// utils/auth.ts
import { auth } from "@s3-viewer/auth";
import { fromNodeHeaders } from "better-auth/node";
var authGuard = (req, res, next) => {
  console.log("Authenticating request");
  auth.api.getSession({
    headers: fromNodeHeaders(req.headers)
  }).then((session) => {
    if (!session) {
      return res.status(401).json({
        message: "Unauthorized, please login to continue"
      });
    }
    req.user = session.user;
    next();
  }).catch((error) => {
    console.log("Auth error:", error);
    res.status(401).json({
      message: "Invalid session"
    });
  });
};
var auth_default = authGuard;

// utils/formatBuckets.ts
var formatBuckets = (response) => {
  return response.Buckets.map((bucket) => ({
    Name: bucket.Name,
    CreationDate: bucket.CreationDate
  }));
};
var formatBuckets_default = formatBuckets;

// utils/permission.ts
import { prisma as prisma2 } from "@s3-viewer/db";
var hasPermissions = async (serverId, userId, authorizedRoles) => {
  const accessPermissions = await prisma2.serverAccess.findUnique({
    where: {
      userId_serverId: {
        userId,
        serverId
      }
    },
    select: {
      role: true
    }
  });
  if (!accessPermissions) {
    return false;
  }
  return authorizedRoles.includes(accessPermissions.role);
};
var permission_default = hasPermissions;

// routes/s3-operations/bucket.ts
var bucketRouter = Router();
bucketRouter.use(auth_default);
bucketRouter.put("/create", async (req, res) => {
  const { bucketName, serverId, user } = req.body;
  if (!serverId) {
    res.status(400).json({ message: "Server ID is required" });
    return;
  }
  if (!permission_default(serverId, user.id, ["OWNER", "ADMIN"])) {
    res.status(403).json({ message: "User does not have permission to create buckets" });
    return;
  }
  const s3Client = await getS3Client(serverId);
  const command = new CreateBucketCommand({ Bucket: bucketName });
  try {
    await s3Client.send(command);
    res.status(201).json({ message: `Bucket ${bucketName} created successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
bucketRouter.delete("/delete", async (req, res) => {
  const { bucketName, serverId, user } = req.body;
  if (!serverId) {
    res.status(400).json({ message: "Server ID is required" });
    return;
  }
  if (!permission_default(serverId, user.id, ["OWNER", "ADMIN"])) {
    res.status(403).json({ message: "User does not have permission to delete buckets" });
    return;
  }
  const s3Client = await getS3Client(serverId);
  const command = new DeleteBucketCommand({ Bucket: bucketName });
  try {
    await s3Client.send(command);
    res.status(200).json({ message: `Bucket ${bucketName} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
bucketRouter.get("/list", async (req, res) => {
  const { serverId, user } = req.body;
  if (!serverId) {
    res.status(400).json({ message: "Server ID is required" });
    return;
  }
  if (!permission_default(serverId, user.id, ["OWNER", "ADMIN", "EDITOR", "VIEWER"])) {
    res.status(403).json({ message: "User does not have permission to list buckets" });
    return;
  }
  const s3Client = await getS3Client(serverId);
  const command = new ListBucketsCommand({});
  try {
    const response = await s3Client.send(command);
    res.status(200).json(formatBuckets_default(response));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var bucket_default = bucketRouter;

// routes/s3-operations/object.ts
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Router as Router2 } from "express";
var objectRouter = Router2();
objectRouter.use(auth_default);
objectRouter.put("/create", async (req, res) => {
  const { bucketName, objectKey, file, contentType, serverId, user } = req.body;
  if (!serverId) {
    res.status(400).json({ message: "Server ID is required" });
    return;
  }
  if (!permission_default(serverId, user.id, ["OWNER", "ADMIN", "EDITOR"])) {
    res.status(403).json({ message: "User does not have permission to create objects" });
    return;
  }
  const s3Client = await getS3Client(serverId);
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
  const { bucketName, objectKey, serverId, user } = req.body;
  if (!serverId) {
    res.status(400).json({ message: "Server ID is required" });
    return;
  }
  if (!permission_default(serverId, user.id, ["OWNER", "ADMIN", "EDITOR", "VIEWER"])) {
    res.status(403).json({ message: "User does not have permission to get objects" });
    return;
  }
  const s3Client = await getS3Client(serverId);
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
  const { bucketName, objectKey, serverId, user } = req.body;
  if (!serverId) {
    res.status(400).json({ message: "Server ID is required" });
    return;
  }
  if (!permission_default(serverId, user.id, ["OWNER", "ADMIN", "EDITOR"])) {
    res.status(403).json({ message: "User does not have permission to delete objects" });
    return;
  }
  const s3Client = await getS3Client(serverId);
  const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey });
  try {
    await s3Client.send(command);
    res.status(200).json({ message: `Object ${objectKey} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
objectRouter.post("/copy", async (req, res) => {
  const { sourceBucket, sourceKey, targetBucket, targetKey, serverId, user } = req.body;
  if (!serverId) {
    res.status(400).json({ message: "Server ID is required" });
    return;
  }
  if (!permission_default(serverId, user.id, ["OWNER", "ADMIN", "EDITOR"])) {
    res.status(403).json({ message: "User does not have permission to copy objects" });
    return;
  }
  const s3Client = await getS3Client(serverId);
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
  const { sourceBucket, sourceKey, targetBucket, targetKey, serverId, user } = req.body;
  if (!serverId) {
    res.status(400).json({ message: "Server ID is required" });
    return;
  }
  if (!permission_default(serverId, user.id, ["OWNER", "ADMIN", "EDITOR"])) {
    res.status(403).json({ message: "User does not have permission to move objects" });
    return;
  }
  const s3Client = await getS3Client(serverId);
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

// routes/s3-servers/manage.ts
import { ListBucketsCommand as ListBucketsCommand2 } from "@aws-sdk/client-s3";
import { prisma as prisma3 } from "@s3-viewer/db";
import { Router as Router3 } from "express";
var manageRouter = Router3();
manageRouter.use(auth_default);
manageRouter.post("/establish", async (req, res) => {
  console.log("Establishing connection");
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const credentials = req.body;
  const s3Client = getS3ClientFromCredentials(credentials);
  const response = await s3Client.send(new ListBucketsCommand2({}));
  if (response.Buckets) {
    res.status(200).json({ message: "Server connected established successfully" });
  } else {
    res.status(400).json({ message: "Server connection failed, are you sure you're using the correct credentials?" });
  }
});
manageRouter.post("/create", async (req, res) => {
  console.log("Creating server");
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { serverCredentials, serverName } = req.body;
  try {
    const server2 = await prisma3.server.create({
      data: {
        credentials: JSON.stringify(serverCredentials),
        name: serverName,
        ownerId: req.user.id,
        serverAccess: {
          create: {
            userId: req.user.id,
            role: "OWNER"
          }
        }
      }
    });
    res.status(200).json({ message: "Server created successfully", serverId: server2.id });
  } catch (error) {
    res.status(400).json({ message: "Server creation failed: " + error });
  }
});
manageRouter.delete("/delete", async (req, res) => {
  console.log("Deleting server");
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { serverId } = req.body;
  try {
    await prisma3.server.delete({
      where: { id: serverId }
    });
    res.status(200).json({ message: "Server deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Server deletion failed: " + error });
  }
});
var manage_default = manageRouter;

// routes/s3-servers/retrieve.ts
import { prisma as prisma4 } from "@s3-viewer/db";
import { Router as Router4 } from "express";
var retrieveRouter = Router4();
retrieveRouter.use(auth_default);
retrieveRouter.get("/get-servers", async (req, res) => {
  console.log("Getting servers");
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const servers = await prisma4.serverAccess.findMany({
    where: {
      userId: req.user.id
    },
    select: {
      server: {
        select: {
          id: true,
          name: true,
          storageUsed: true
        }
      }
    }
  });
  const serversList = servers.map((server2) => ({
    id: server2.server.id,
    name: server2.server.name,
    storageUsed: server2.server.storageUsed
  }));
  res.status(200).json({ serversList });
});
retrieveRouter.get("/get-server-name", async (req, res) => {
  console.log("Getting server name");
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { serverId } = req.query;
  const serverName = await prisma4.server.findUnique({
    where: {
      id: serverId
    },
    select: {
      name: true
    }
  });
  res.status(200).json({ serverName });
});
var retrieve_default = retrieveRouter;

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
app.all("/auth/{*any}", toNodeHandler(auth2));
app.use(express.json());
app.use("/bucket", bucket_default);
app.use("/object", object_default);
app.use("/manage", manage_default);
app.use("/retrieve", retrieve_default);
app.get("/", (req, res) => {
  res.send("Can I see this?");
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
