import { prisma } from "@s3-viewer/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";

/*
 * This is needed here as this code is called from apps/api/server.ts
 * and will use the .env file in the api directory.
 */
import dotenv from "dotenv";
dotenv.config();

// .env vars found in apps/api/.env, not in root or packages. No need to import dotenv here.
export const auth = betterAuth({
   baseUrl: process.env.AUTH_SERVER_URL || "http://localhost:5001",
   basePath: "/auth",
   database: prismaAdapter(prisma, {
      provider: "postgresql",
   }),
   trustedOrigins: [process.env.WEB_URL || "http://localhost:3000"],
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
   plugins: [
      emailOTP({
         sendVerificationOnSignUp: true,
         async sendVerificationOTP({ email, otp, type }) {
            if (type === "sign-in") {
               console.log(`Sending OTP to ${email}: ${otp}`);
            } else if (type === "email-verification") {
               console.log(`Sending verification email to ${email}: ${otp}`);
            }
         },
      }),
   ],
});
