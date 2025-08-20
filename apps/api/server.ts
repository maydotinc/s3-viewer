import { auth } from "@s3-viewer/auth";
import { Role } from "@s3-viewer/types";
import { User } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import dotenv from "dotenv";
import express, { urlencoded } from "express";
import authGuard from "./lib/middleware/auth.js";
import s3Router from "./routes/s3-operations/index.js";
import serverRouter from "./routes/s3-servers/index.js";
import userRouter from "./routes/users/user-manage.js";

declare global {
   namespace Express {
      interface Request {
         userRole?: Role;
         user?: User;
      }
   }
}

dotenv.config();

const app = express();

app.disable("x-powered-by");
app.use(urlencoded({ extended: true }));
app.use(
   cors({
      origin: process.env.NEXT_PUBLIC_FRONTEND_URL,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
   })
);

app.all("/auth/{*any}", toNodeHandler(auth));
app.use(express.json());
app.use("/user", userRouter);
app.use(authGuard);

app.use("/s3", s3Router);
app.use("/server", serverRouter);

const server = app.listen(process.env.PORT || 5001, () => {
   console.log(`API Server is running on port ${process.env.PORT || 5001}`);
});

const connections = new Set();
server.on("connection", (connection: any) => {
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
         connections.forEach((conn: any) => conn.destroy());
         process.exit(1);
      }, 5000);
   });
});
