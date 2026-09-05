import { AUTH_BASE_PATH, SITE_PATHS } from "@s3-viewer/types";
import { createAuthClient } from "better-auth/react";
import { authErrorMessage, type AuthClientError } from "./errors";
import { localPart } from "./utils";

type AuthClientOptions = { apiOrigin: string; siteOrigin: string };

type AuthResult = { error: string | null; code?: string };
type ContinueResult = AuthResult & { created: boolean };

const PASSWORD_PROVIDER = "credential";
const WRONG_CREDENTIALS = "INVALID_EMAIL_OR_PASSWORD";
const ALREADY_EXISTS = new Set([
   "USER_ALREADY_EXISTS",
   "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

const makeAuthClient = ({ apiOrigin, siteOrigin }: AuthClientOptions) => {
   const authClient = createAuthClient({
      baseURL: apiOrigin,
      basePath: AUTH_BASE_PATH,
      fetchOptions: { credentials: "include" },
   });

   const siteUrl = (path: string) => `${siteOrigin}${path}`;

   const toResult = ({
      error,
   }: {
      error: AuthClientError | null;
   }): AuthResult =>
      error
         ? { error: authErrorMessage(error), code: error.code }
         : { error: null };

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
         .email({
            email,
            password,
            name: localPart(email),
            // where the verification link sent at sign-up lands
            callbackURL: siteUrl(SITE_PATHS.settingsProfile),
         })
         .then(toResult);

   // sign-in and sign-up are one flow: a password that matches signs in, an
   // address with no account is created with it, and anything else is a wrong
   // password. Sign-up already reveals an existing address, so this leaks
   // nothing new
   const continueWithPassword = async (
      email: string,
      password: string
   ): Promise<ContinueResult> => {
      const signedIn = await signInWithPassword(email, password);
      if (signedIn.code !== WRONG_CREDENTIALS) {
         return { ...signedIn, created: false };
      }
      const created = await signUpWithPassword(email, password);
      if (created.code && ALREADY_EXISTS.has(created.code)) {
         return { ...signedIn, created: false };
      }
      return { ...created, created: !created.error };
   };

   // the emailed link lands on /reset-password?token=… (or ?error=…)
   const requestPasswordReset = (email: string): Promise<AuthResult> =>
      authClient
         .requestPasswordReset({
            email,
            redirectTo: siteUrl(SITE_PATHS.resetPassword),
         })
         .then(toResult);

   const resetPassword = (
      token: string,
      newPassword: string
   ): Promise<AuthResult> =>
      authClient.resetPassword({ token, newPassword }).then(toResult);

   // the emailed link lands on the profile page, which shows the address's
   // status either way
   const sendVerificationEmail = (email: string): Promise<AuthResult> =>
      authClient
         .sendVerificationEmail({
            email,
            callbackURL: siteUrl(SITE_PATHS.settingsProfile),
         })
         .then(toResult);

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
            callbackURL: siteUrl(SITE_PATHS.dashboard),
         })
         .then(toResult);

   const signOut = async (): Promise<void> => {
      await authClient.signOut();
   };

   return {
      authClient,
      changePassword,
      continueWithPassword,
      hasPassword,
      requestPasswordReset,
      resetPassword,
      sendVerificationEmail,
      signInWithGithub,
      signInWithPassword,
      signOut,
      signUpWithPassword,
   };
};

export { makeAuthClient };
export type { AuthResult, ContinueResult };
