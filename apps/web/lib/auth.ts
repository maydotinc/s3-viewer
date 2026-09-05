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
type SessionValue = {
   data: unknown;
   error: unknown;
   isPending: boolean;
   isRefetching: boolean;
   refetch?: () => Promise<unknown>;
};
type SessionAtom = {
   get: () => SessionValue;
   set: (value: SessionValue) => void;
   listen: (listener: (value: SessionValue) => void) => () => void;
};
const sessionAtom = authClient.$store.atoms.session as unknown as
   | SessionAtom
   | undefined;

const SIGN_OUT_SETTLE_MS = 3000;

const isSettledSignedOut = ({ data, isPending, isRefetching }: SessionValue) =>
   data === null && !isPending && !isRefetching;

// `useSession()` keeps the old user until better-auth's own `/get-session`
// refetch lands, and that refetch is scheduled 10ms after `/sign-out`
// succeeds, cancelling any refetch already in flight. Navigating before the
// store reads signed out lands the login page on a signed-in user, which
// bounces to the dashboard, which bounces back with `?next=`. So wait for the
// store itself to settle, and past a deadline settle it by hand.
const settleSignedOut = (): Promise<void> =>
   new Promise((resolve) => {
      if (!sessionAtom || isSettledSignedOut(sessionAtom.get())) {
         resolve();
         return;
      }
      let done = false;
      const finish = () => {
         if (done) return;
         done = true;
         clearTimeout(deadline);
         unlisten();
         resolve();
      };
      const unlisten = sessionAtom.listen((value) => {
         if (isSettledSignedOut(value)) finish();
      });
      const deadline = setTimeout(() => {
         sessionAtom.set({
            ...sessionAtom.get(),
            data: null,
            error: null,
            isPending: false,
            isRefetching: false,
         });
         finish();
      }, SIGN_OUT_SETTLE_MS);
      void sessionAtom.get().refetch?.();
   });

const setPassword = (password: string): Promise<void> =>
   api.post<void>("/account/password", { password });

let signingOut = false;

// true from the start of `signOut()` until the login page is shown
const isSigningOut = (): boolean => signingOut;

// a sign-out the server refused leaves the session in place, so it throws
// for the caller to show and changes nothing locally
const signOut = async (
   redirectTo: string = SITE_PATHS.login
): Promise<void> => {
   signingOut = true;
   try {
      await endSession();
      await settleSignedOut();
      clearQueryCache();
      useSessionStore.getState().clearSession();
      await Router.replace(redirectTo);
   } finally {
      signingOut = false;
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
