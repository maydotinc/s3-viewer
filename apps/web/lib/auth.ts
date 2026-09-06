import { api, setUnauthorizedHandler } from "@/lib/api";
import { loginPathFor } from "@/lib/auth-redirect";
import { publicEnv } from "@/lib/env";
import { clearQueryCache } from "@/lib/queryClient";
import useSessionStore from "@/lib/stores/sessionStore";
import useUploadStore from "@/lib/stores/upload-store/uploadStore";
import { makeAuthClient, type AuthResult } from "@s3-viewer/auth/client";
import { SITE_PATHS } from "@s3-viewer/types";
import Router from "next/router";

const {
   authClient,
   changePassword,
   continueWithPassword,
   deleteAccount,
   hasPassword,
   requestPasswordReset,
   resetPassword,
   sendVerificationEmail,
   signInWithGithub,
   signOut: endSession,
} = makeAuthClient(publicEnv);

// better-auth types its atoms loosely; this is the slice we rely on
type SessionValue = {
   data: { user: { id: string } } | null;
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

const syncSession = (value: SessionValue): void => {
   if (signingOut) return;
   if (value.data) useSessionStore.getState().setUserId(value.data.user.id);
   else if (
      isSettledSignedOut(value) &&
      (!value.error ||
         (typeof value.error === "object" &&
            "status" in value.error &&
            value.error.status === 401))
   )
      useSessionStore.getState().clearSession();
};

if (sessionAtom) {
   sessionAtom.listen(syncSession);
   syncSession(sessionAtom.get());
}

const signOut = async (
   redirectTo: string = SITE_PATHS.login
): Promise<void> => {
   signingOut = true;
   const previous = useSessionStore.getState();
   useSessionStore.getState().clearSession();
   useUploadStore.getState().dismiss();
   try {
      await endSession();
      await settleSignedOut();
      clearQueryCache();
      useSessionStore.getState().clearSession();
      await Router.replace(redirectTo);
   } catch (error) {
      signingOut = false;
      if (sessionAtom) syncSession(sessionAtom.get());
      if (useSessionStore.getState().userId === previous.userId)
         useSessionStore.getState().setServerId(previous.serverId);
      throw error;
   } finally {
      signingOut = false;
      if (sessionAtom) syncSession(sessionAtom.get());
   }
};

// the api refused a session the auth client still holds (past its absolute
// age, revoked elsewhere). ending it here keeps the two in step: the cookie
// goes, and the login page says why and knows the way back. a 401 while the
// client already reads signed out is the guard's to handle, and one during a
// sign-out is that sign-out's own
setUnauthorizedHandler(() => {
   useSessionStore.getState().clearSession();
   useUploadStore.getState().dismiss();
   if (signingOut || sessionAtom?.get().data == null) return;
   void signOut(loginPathFor(Router.asPath, "expired")).catch(() => undefined);
});

// asks better-auth for the session again, e.g. after the api was unreachable
const refetchSession = (): Promise<void> =>
   Promise.resolve(sessionAtom?.get().refetch?.()).then(() => undefined);

export {
   authClient,
   changePassword,
   continueWithPassword,
   deleteAccount,
   hasPassword,
   isSigningOut,
   refetchSession,
   requestPasswordReset,
   resetPassword,
   sendVerificationEmail,
   setPassword,
   signInWithGithub,
   signOut,
};
export type { AuthResult };
