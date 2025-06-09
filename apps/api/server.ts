import { auth } from "@s3-viewer/auth";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import dotenv from "dotenv";
import express, { urlencoded } from "express";
import bucketRouter from "./routes/bucket.js";
import objectRouter from "./routes/object.js";
dotenv.config();

const app = express();

app.disable('x-powered-by')
app.use(urlencoded({ extended: true }))
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
}));

// auth routes - must be before express.json()
app.all('/auth/{*any}', toNodeHandler(auth));

// body parsing after auth
app.use(express.json());

app.use("/bucket", bucketRouter);
app.use("/object", objectRouter);

app.get("/", (req, res) => {
    res.send("Can I see this?");
});


const server = app.listen(process.env.PORT || 3001, () => {
    console.log(`API Server is running on port ${process.env.PORT || 3001}`);
});

// Track connections to close them gracefully
const connections = new Set();
server.on('connection', (connection: any) => {
    connections.add(connection);
    connection.on('close', () => {
        connections.delete(connection);
    });
});

// Handle termination signals
['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(signal => {
    process.on(signal, () => {
        console.log(`${signal} received, shutting down gracefully`);
        
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
        
        // Force-close connections after timeout
        setTimeout(() => {
            console.log('Forcing server close');
            connections.forEach((conn: any) => conn.destroy());
            process.exit(1);
        }, 5000);
    });
});