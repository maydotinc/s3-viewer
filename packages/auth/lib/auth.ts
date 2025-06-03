import { prisma } from "@s3-viewer/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

/*
 * This is needed here as this code is called from apps/api/server.ts
 * and will use the .env file in the api directory.
*/ 
import dotenv from "dotenv";
dotenv.config();

// .env vars found in apps/api/.env, not in root or packages. No need to import dotenv here.
export const auth = betterAuth({
    baseUrl: process.env.AUTH_SERVER_URL || "http://localhost:3001",
    basePath: "/auth",
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }), 
    trustedOrigins: [process.env.WEB_URL || "http://localhost:3000"],    
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 4,
        autoSignIn: true,
    },
    socialProviders: {
        google: {
            enabled: false,
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
        github: {
            enabled: false,
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
    },
});