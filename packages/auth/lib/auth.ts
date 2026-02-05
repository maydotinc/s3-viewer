import { prisma } from "@s3-viewer/db";
import S3ViewerEmailOTP from "@s3-viewer/ui/emails/auth-otp";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { validateEnv } from "./utils";

validateEnv();

let resendInstance: any = null;
async function getResend() {
   if (!resendInstance) {
      const { Resend } = await import("resend");
      resendInstance = new Resend(process.env.RESEND_KEY);
   }
   return resendInstance;
}

export const auth = betterAuth({
   baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
   basePath: "/auth",
   database: prismaAdapter(prisma, {
      provider: "postgresql",
   }),
   trustedOrigins: [process.env.NEXT_PUBLIC_FRONTEND_URL as string].filter(
      Boolean
   ),
   plugins: [
      emailOTP({
         sendVerificationOnSignUp: true,
         async sendVerificationOTP({ email, otp }) {
            if (process.env.NODE_ENV !== "production") {
               console.log(`Sending OTP to ${email}: ${otp}`);
            } else {
               try {
                  const resend = await getResend();
                  const { error } = await resend.emails.send({
                     from: "S3 Viewer <auth@s3-viewer.com>",
                     to: [email],
                     subject: "S3 Viewer Login Code",
                     react: S3ViewerEmailOTP({ loginCode: otp }),
                  });

                  if (error) {
                     throw new Error(`${error.name}: ${error.message}`);
                  }

                  console.log("Sent OTP using Resend");
               } catch (error) {
                  console.error("Error sending OTP:", error);
               }
            }
         },
      }),
   ],
});
