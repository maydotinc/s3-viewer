import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import { clearQueryCache } from "@/lib/queryClient";
import useSessionStore from "@/lib/stores/sessionStore";
import { makeAuthClient } from "@s3-viewer/auth/client";
import { SITE_PATHS } from "@s3-viewer/types";
import Router from "next/router";

const {
   authClient,
   verifyOtp,
   signInWithGithub,
   signOut: endSession,
} = makeAuthClient(publicEnv);

// better-auth types its atoms loosely; this is the slice of the session atom
// we rely on (the same nanostore `authClient.useSession()` reads from).
type SessionAtom = { get: () => { refetch?: () => Promise<unknown> } };
const sessionAtom = authClient.$store.atoms.session as SessionAtom | undefined;

const startAuthFlow = (email: string): Promise<void> =>
   api.post<void>("/auth-flow/start", { email });

let signingOut = false;

/** True from the start of `signOut()` until the login page is shown. */
const isSigningOut = (): boolean => signingOut;

/**
 * Sign out is one ordered sequence and the single owner of where the user
 * lands afterwards: end the server session, wait until `useSession()` no
 * longer reports the old user, then drop the query cache and the persisted
 * session, then replace the route with the login page. The teardown and the
 * navigation always run, even if the sign-out request or the refetch throws.
 */
const signOut = async (): Promise<void> => {
   signingOut = true;
   try {
      await endSession();
      // better-auth 1.2.8 only refetches `/get-session` in the background
      // after `/sign-out` and keeps the old user in `useSession()` until that
      // resolves. Awaiting the atom's own refetch (via `$store.atoms.session`)
      // makes the signed-out state visible before the caches below are
      // emptied, so nothing renders a signed-in user with no data.
      await sessionAtom?.get()?.refetch?.();
   } finally {
      clearQueryCache();
      useSessionStore.getState().clearSession();
      try {
         await Router.replace(SITE_PATHS.login);
      } finally {
         signingOut = false;
      }
   }
};

export {
   authClient,
   isSigningOut,
   signInWithGithub,
   signOut,
   startAuthFlow,
   verifyOtp,
};
