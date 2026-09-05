import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import { clearQueryCache } from "@/lib/queryClient";
import useSessionStore from "@/lib/stores/sessionStore";
import { makeAuthClient, type AuthResult } from "@s3-viewer/auth/client";
import { SITE_PATHS } from "@s3-viewer/types";
import Router from "next/router";

const {
   authClient,
   changePassword,
   continueWithPassword,
   hasPassword,
   requestPasswordReset,
   resetPassword,
   sendVerificationEmail,
   signInWithGithub,
   signOut: endSession,
} = makeAuthClient(publicEnv);

// better-auth types its atoms loosely; this is the slice we rely on
type SessionAtom = { get: () => { refetch?: () => Promise<unknown> } };
const sessionAtom = authClient.$store.atoms.session as SessionAtom | undefined;

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
   continueWithPassword,
   hasPassword,
   isSigningOut,
   requestPasswordReset,
   resetPassword,
   sendVerificationEmail,
   setPassword,
   signInWithGithub,
   signOut,
};
export type { AuthResult };
