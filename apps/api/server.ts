import { auth } from "@s3-viewer/auth";
import { Role } from "@s3-viewer/types";
import { User } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import dotenv from "dotenv";
import express, { urlencoded } from "express";
import s3Router from "./routes/s3-operations/index.js";
import serverRouter from "./routes/s3-servers/index.js";
import userRouter from "./routes/users/user-manage.js";

// Extend Express Request type to include userRole
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
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
   })
);

// auth routes - must be before express.json()
app.all("/auth/{*any}", toNodeHandler(auth));

// body parsing after auth
app.use(express.json());

app.use("/s3", s3Router);
app.use("/server", serverRouter);
app.use("/user", userRouter);

// for testing
app.get("/", (req, res) => {
   res.send("Can I see this?");
});

const server = app.listen(process.env.PORT || 5001, () => {
   console.log(`API Server is running on port ${process.env.PORT || 5001}`);
});

// Track connections to close them gracefully
const connections = new Set();
server.on("connection", (connection: any) => {
   connections.add(connection);
   connection.on("close", () => {
      connections.delete(connection);
   });
});

// Handle termination signals
["SIGINT", "SIGTERM", "SIGUSR2"].forEach((signal) => {
   process.on(signal, () => {
      console.log(`${signal} received, shutting down gracefully`);

      server.close(() => {
         console.log("HTTP server closed");
         process.exit(0);
      });

      // Force-close connections after timeout
      setTimeout(() => {
         console.log("Forcing server close");
         connections.forEach((conn: any) => conn.destroy());
         process.exit(1);
      }, 5000);
   });
});
