import { api, errorMessage } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import { clearQueryCache } from "@/lib/queryClient";
import useSessionStore from "@/lib/stores/sessionStore";
import { makeAuthClient, type AuthResult } from "@s3-viewer/auth/client";
import { SITE_PATHS } from "@s3-viewer/types";
import Router from "next/router";

const {
   authClient,
   changePassword,
   hasPassword,
   requestPasswordReset,
   resetPassword,
   sendVerificationCode,
   signInWithGithub,
   signInWithPassword,
   signOut: endSession,
   signUpWithPassword,
   verifyEmail,
   verifyOtp,
} = makeAuthClient(publicEnv);

// better-auth types its atoms loosely; this is the slice we rely on
type SessionAtom = { get: () => { refetch?: () => Promise<unknown> } };
const sessionAtom = authClient.$store.atoms.session as SessionAtom | undefined;

// one email carrying a code and a sign-in link; the api answers 204 whether or
// not the address has an account
const requestSignInCode = async (email: string): Promise<AuthResult> => {
   try {
      await api.post<void>("/auth-flow/start", { email });
      return { error: null };
   } catch (error) {
      return { error: errorMessage(error) };
   }
};

const setPassword = (password: string): Promise<void> =>
   api.post<void>("/account/password", { password });

let signingOut = false;

// true from the start of `signOut()` until the login page is shown
const isSigningOut = (): boolean => signingOut;

const signOut = async (
   redirectTo: string = SITE_PATHS.login
): Promise<void> => {
   signingOut = true;
   try {
      await endSession();
      // better-auth 1.2.8 refetches `/get-session` in the background and keeps
      // the old user in `useSession()` until it resolves; await the atom's own
      // refetch so nothing renders a signed-in user with no data.
      await sessionAtom?.get()?.refetch?.();
   } finally {
      clearQueryCache();
      useSessionStore.getState().clearSession();
      try {
         await Router.replace(redirectTo);
      } finally {
         signingOut = false;
      }
   }
};

export {
   authClient,
   changePassword,
   hasPassword,
   isSigningOut,
   requestPasswordReset,
   requestSignInCode,
   resetPassword,
   sendVerificationCode,
   setPassword,
   signInWithGithub,
   signInWithPassword,
   signOut,
   signUpWithPassword,
   verifyEmail,
   verifyOtp,
};
export type { AuthResult };
