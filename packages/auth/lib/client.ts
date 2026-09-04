import { AUTH_BASE_PATH, SITE_PATHS } from "@s3-viewer/types";
import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { authErrorMessage, type AuthClientError } from "./errors";
import { localPart } from "./utils";

type AuthClientOptions = { apiOrigin: string; siteOrigin: string };

type AuthResult = { error: string | null };

const PASSWORD_PROVIDER = "credential";

const makeAuthClient = ({ apiOrigin, siteOrigin }: AuthClientOptions) => {
   const authClient = createAuthClient({
      baseURL: apiOrigin,
      basePath: AUTH_BASE_PATH,
      fetchOptions: { credentials: "include" },
      plugins: [emailOTPClient(), magicLinkClient()],
   });

   const toResult = ({
      error,
   }: {
      error: AuthClientError | null;
   }): AuthResult => ({ error: error ? authErrorMessage(error) : null });

   const verifyOtp = (email: string, otp: string): Promise<AuthResult> =>
      authClient.signIn.emailOtp({ email, otp }).then(toResult);

   const signInWithPassword = (
      email: string,
      password: string
   ): Promise<AuthResult> =>
      authClient.signIn.email({ email, password }).then(toResult);

   const signUpWithPassword = (
      email: string,
      password: string
   ): Promise<AuthResult> =>
      authClient.signUp
         .email({ email, password, name: localPart(email) })
         .then(toResult);

   const requestPasswordReset = (email: string): Promise<AuthResult> =>
      authClient.emailOtp.requestPasswordReset({ email }).then(toResult);

   const resetPassword = (
      email: string,
      otp: string,
      password: string
   ): Promise<AuthResult> =>
      authClient.emailOtp
         .resetPassword({ email, otp, password })
         .then(toResult);

   const sendVerificationCode = (email: string): Promise<AuthResult> =>
      authClient.emailOtp
         .sendVerificationOtp({ email, type: "email-verification" })
         .then(toResult);

   const verifyEmail = (email: string, otp: string): Promise<AuthResult> =>
      authClient.emailOtp.verifyEmail({ email, otp }).then(toResult);

   const changePassword = (
      currentPassword: string,
      newPassword: string
   ): Promise<AuthResult> =>
      authClient
         .changePassword({
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
         })
         .then(toResult);

   const hasPassword = async (): Promise<boolean> => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new Error(authErrorMessage(error));
      return (data ?? []).some(
         (account) => account.providerId === PASSWORD_PROVIDER
      );
   };

   const signInWithGithub = (): Promise<AuthResult> =>
      authClient.signIn
         .social({
            provider: "github",
            callbackURL: `${siteOrigin}${SITE_PATHS.dashboard}`,
         })
         .then(toResult);

   const signOut = async (): Promise<void> => {
      await authClient.signOut();
   };

   return {
      authClient,
      changePassword,
      hasPassword,
      requestPasswordReset,
      resetPassword,
      sendVerificationCode,
      signInWithGithub,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      verifyEmail,
      verifyOtp,
   };
};

export { makeAuthClient };
export type { AuthResult };
