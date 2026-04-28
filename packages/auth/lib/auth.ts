import { prisma } from "@s3-viewer/db";
import { sendOtpEmail } from "@s3-viewer/email";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { validateEnv } from "./utils";

validateEnv();

const auth = betterAuth({
   baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
   basePath: "/auth",
   database: prismaAdapter(prisma, {
      provider: "postgresql",
   }),
   trustedOrigins: [process.env.NEXT_PUBLIC_FRONTEND_URL as string],
   advanced: {
      defaultCookieAttributes: {
         sameSite: "none",
         secure: true,
      },
   },
   plugins: [
      emailOTP({
         sendVerificationOnSignUp: true,
         async sendVerificationOTP({ email, otp }) {
            await sendOtpEmail({ to: email, otp });
         },
      }),
   ],
   socialProviders: {
      github: {
         clientId: process.env.GITHUB_CLIENT_ID as string,
         clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
   },
});

export { auth };
