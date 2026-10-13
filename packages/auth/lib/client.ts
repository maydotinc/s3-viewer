import {
   AUTH_BASE_PATH,
   EXPECTED_USER_ID_HEADER,
   INVITE_TOKEN_HEADER,
   SITE_PATHS,
   PROFILE_NAME_MAX,
   profileNameSchema,
   type DeleteAccountInput,
} from "@s3-viewer/types";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import {
   AuthErrorCode,
   authErrorMessage,
   type AuthClientError,
} from "./errors";
import { localPart } from "./utils";

type AuthClientOptions = {
   apiOrigin: string;
   siteOrigin: string;
   getExpectedUserId?: () => string | null;
};

type AuthResult = { error: string | null; code?: string };
type ContinueResult = AuthResult & { created: boolean };
type ContinueOptions = { allowSignUp?: boolean; inviteId?: string };

const PASSWORD_PROVIDER = "credential";
const UNREACHABLE: AuthResult = {
   error: "Couldn't reach the server. Check your connection and try again.",
   code: AuthErrorCode.NETWORK,
};
const ALREADY_EXISTS = new Set([
   "USER_ALREADY_EXISTS",
   "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

const makeAuthClient = ({
   apiOrigin,
   siteOrigin,
   getExpectedUserId,
}: AuthClientOptions) => {
   const authClient = createAuthClient({
      baseURL: apiOrigin,
      basePath: AUTH_BASE_PATH,
      fetchOptions: { credentials: "include" },
      plugins: [emailOTPClient()],
   });

   const accountFetchOptions = (expectedUserId = getExpectedUserId?.()) => ({
      headers: expectedUserId
         ? { [EXPECTED_USER_ID_HEADER]: expectedUserId }
         : {},
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

   const settled = (
      request: Promise<{ error: AuthClientError | null }>
   ): Promise<AuthResult> => request.then(toResult, () => UNREACHABLE);

   const signInWithPassword = (
      email: string,
      password: string
   ): Promise<AuthResult> =>
      settled(authClient.signIn.email({ email, password }));

   const signUpWithPassword = (
      email: string,
      password: string,
      inviteId?: string
   ): Promise<AuthResult> =>
      settled(
         authClient.signUp.email({
            email,
            password,
            name:
               profileNameSchema.safeParse(
                  localPart(email).slice(0, PROFILE_NAME_MAX)
               ).data ?? "New user",
            ...(inviteId && {
               fetchOptions: { headers: { [INVITE_TOKEN_HEADER]: inviteId } },
            }),
         })
      );

   const continueWithPassword = async (
      email: string,
      password: string,
      { allowSignUp = true, inviteId }: ContinueOptions = {}
   ): Promise<ContinueResult> => {
      const signedIn = await signInWithPassword(email, password);
      if (
         !allowSignUp ||
         signedIn.code !== AuthErrorCode.INVALID_EMAIL_OR_PASSWORD
      ) {
         return { ...signedIn, created: false };
      }
      const created = await signUpWithPassword(email, password, inviteId);
      if (created.code && ALREADY_EXISTS.has(created.code)) {
         return { ...signedIn, created: false };
      }
      if (created.code === AuthErrorCode.SIGNUP_INVITE_REQUIRED) {
         if (inviteId === undefined) return { ...signedIn, created: false };
         return {
            error: `${signedIn.error} ${created.error}`,
            code: created.code,
            created: false,
         };
      }
      return { ...created, created: !created.error };
   };

   const requestPasswordReset = (email: string): Promise<AuthResult> =>
      settled(
         authClient.requestPasswordReset({
            email,
            redirectTo: siteUrl(SITE_PATHS.resetPassword),
         })
      );

   const resetPassword = (
      token: string,
      newPassword: string
   ): Promise<AuthResult> =>
      settled(authClient.resetPassword({ token, newPassword }));

   const sendVerificationCode = (email: string): Promise<AuthResult> =>
      settled(
         authClient.emailOtp.sendVerificationOtp({
            email,
            type: "email-verification",
         })
      );

   // the server accepts a code only together with the password; success opens the session.
   const verifyEmailCode = (
      email: string,
      code: string,
      password: string
   ): Promise<AuthResult> =>
      settled(
         authClient.$fetch("/email-otp/verify-email", {
            method: "POST",
            body: { email, otp: code, password },
         })
      );

   const changePassword = (
      currentPassword: string,
      newPassword: string
   ): Promise<AuthResult> =>
      settled(
         authClient.changePassword({
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
            fetchOptions: accountFetchOptions(),
         })
      );

   const deleteAccount = (
      confirmation: DeleteAccountInput
   ): Promise<AuthResult> =>
      settled(
         authClient.$fetch("/delete-user", {
            method: "POST",
            body: confirmation,
            ...accountFetchOptions(confirmation.expectedUserId),
         })
      );

   const hasPassword = async (): Promise<boolean> => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new Error(authErrorMessage(error));
      return (data ?? []).some(
         (account) => account.providerId === PASSWORD_PROVIDER
      );
   };

   const signInWithGithub = (
      callbackPath: string = SITE_PATHS.dashboard
   ): Promise<AuthResult> =>
      settled(
         authClient.signIn.social({
            provider: "github",
            callbackURL: siteUrl(callbackPath),
         })
      );

   const signOut = async (
      expectedUserId = getExpectedUserId?.()
   ): Promise<void> => {
      const { error } = await authClient.signOut({
         fetchOptions: accountFetchOptions(expectedUserId),
      });
      if (error) throw new Error(authErrorMessage(error));
   };

   return {
      authClient,
      accountFetchOptions,
      changePassword,
      continueWithPassword,
      deleteAccount,
      hasPassword,
      requestPasswordReset,
      resetPassword,
      sendVerificationCode,
      signInWithGithub,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      verifyEmailCode,
   };
};

export { makeAuthClient };
export {
   AuthErrorCode,
   INVALID_EMAIL_MESSAGE,
   INVALID_NAME_MESSAGE,
   SHARED_SERVERS_CODE,
   SIGN_UPS_BY_INVITE,
   SIGN_UPS_CLOSED,
} from "./errors";
