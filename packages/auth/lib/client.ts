import {
   AUTH_BASE_PATH,
   GENERIC_ERROR_MESSAGE,
   SITE_PATHS,
} from "@s3-viewer/types";
import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

type AuthClientOptions = { apiOrigin: string; siteOrigin: string };

type AuthResult = { error: string | null };

const OTP_ERRORS: Readonly<Record<string, string>> = {
   INVALID_OTP: "That code isn't right. Check it and try again.",
   OTP_EXPIRED: "That code has expired. Request a new one.",
   TOO_MANY_ATTEMPTS: "Too many attempts. Request a new code.",
};

const makeAuthClient = ({ apiOrigin, siteOrigin }: AuthClientOptions) => {
   const authClient = createAuthClient({
      baseURL: apiOrigin,
      basePath: AUTH_BASE_PATH,
      fetchOptions: { credentials: "include" },
      plugins: [emailOTPClient(), magicLinkClient()],
   });

   const verifyOtp = async (
      email: string,
      otp: string
   ): Promise<AuthResult> => {
      const { error } = await authClient.signIn.emailOtp({ email, otp });
      if (!error) return { error: null };
      return {
         error: (error.code && OTP_ERRORS[error.code]) ?? GENERIC_ERROR_MESSAGE,
      };
   };

   const signInWithGithub = async (): Promise<AuthResult> => {
      const { error } = await authClient.signIn.social({
         provider: "github",
         callbackURL: `${siteOrigin}${SITE_PATHS.dashboard}`,
      });
      return { error: error ? GENERIC_ERROR_MESSAGE : null };
   };

   const signOut = async (): Promise<void> => {
      await authClient.signOut();
   };

   return { authClient, verifyOtp, signInWithGithub, signOut };
};

export { makeAuthClient };
