import { api, setUnauthorizedHandler } from "./api";
import { loginPathFor } from "./auth-redirect";
import { publicEnv } from "./env";
import { confirmNavigation } from "./navigation-guard";
import { clearQueryCache } from "./query-client";
import useSessionStore from "@/lib/stores/session-store";
import {
   resetUploads,
   suspendUploads,
   uploadsInProgress,
} from "@/lib/stores/upload-store/lifecycle";
import { forgetAccountSessions } from "@/lib/utils/s3/multipart-session";
import { makeAuthClient } from "@s3-viewer/auth/client";
import { SITE_PATHS } from "@s3-viewer/types";
import Router from "next/router";

const {
   authClient,
   changePassword,
   continueWithPassword,
   deleteAccount,
   hasPassword,
   listSessions,
   requestPasswordReset,
   resetPassword,
   revokeOtherSessions,
   revokeSession,
   sendVerificationCode,
   signInWithGithub,
   signOut: endSession,
   updateProfileName,
   verifyEmailCode,
} = makeAuthClient({
   ...publicEnv,
   getExpectedUserId: () => useSessionStore.getState().userId,
});

type SessionValue = {
   data: { user: { id: string; emailVerified?: boolean } } | null;
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
const SIGN_OUT_UPLOAD_CLEANUP_MS = 3000;

const isSettledSignedOut = ({ data, isPending, isRefetching }: SessionValue) =>
   data === null && !isPending && !isRefetching;

// Better Auth refetches after sign-out; wait so the login page can't redirect a stale user.
const settleSignedOut = (expectedUserId: string | undefined): Promise<void> =>
   new Promise((resolve) => {
      const settled = (value: SessionValue) =>
         isSettledSignedOut(value) ||
         Boolean(value.data && value.data.user.id !== expectedUserId);
      if (!sessionAtom || settled(sessionAtom.get())) {
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
         if (settled(value)) finish();
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
let drainingUploads = false;
let signOutPromise: Promise<void> | null = null;

const settleUploadCleanup = (cleanup: Promise<void>): Promise<void> =>
   new Promise((resolve) => {
      const finish = () => {
         clearTimeout(deadline);
         resolve();
      };
      const deadline = setTimeout(finish, SIGN_OUT_UPLOAD_CLEANUP_MS);
      void cleanup.then(finish, finish);
   });

const isSigningOut = (): boolean => signingOut;

const syncSession = (value: SessionValue): void => {
   if (signingOut && !drainingUploads) return;
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

const signOut = (redirectTo: string = SITE_PATHS.login): Promise<void> => {
   if (signOutPromise) return signOutPromise;
   signingOut = true;
   drainingUploads = true;
   const resumeUploads = suspendUploads();
   const previous = useSessionStore.getState();
   const expectedUserId = previous.userId ?? sessionAtom?.get().data?.user.id;
   const accountChanged = () =>
      [
         useSessionStore.getState().userId,
         sessionAtom?.get().data?.user.id,
      ].some((userId) => userId && userId !== expectedUserId);
   signOutPromise = (async () => {
      try {
         await settleUploadCleanup(
            resetUploads().then(() =>
               expectedUserId
                  ? forgetAccountSessions(expectedUserId)
                  : undefined
            )
         );
         drainingUploads = false;
         if (accountChanged()) return;
         useSessionStore.getState().clearSession();
         await endSession(expectedUserId);
         await settleSignedOut(expectedUserId);
         if (accountChanged()) return;
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
         drainingUploads = false;
         signingOut = false;
         signOutPromise = null;
         if (sessionAtom) syncSession(sessionAtom.get());
         resumeUploads();
      }
   })();
   return signOutPromise;
};

const UPLOADS_RUNNING_MESSAGE =
   "Uploads are still running. Signing out cancels them. Sign out anyway?";

// asks while the session still exists, since guards only recognise their own work under it;
// sign-outs the app forces (an expired or unverified session, a deleted account) go through signOut and never ask
const requestSignOut = (redirectTo?: string): Promise<void> => {
   if (signOutPromise) return signOutPromise;
   if (!confirmNavigation()) return Promise.resolve();
   if (uploadsInProgress() && !window.confirm(UPLOADS_RUNNING_MESSAGE))
      return Promise.resolve();
   return signOut(redirectTo);
};

setUnauthorizedHandler(() => {
   useSessionStore.getState().clearSession();
   void resetUploads();
   if (signingOut || sessionAtom?.get().data == null) return;
   void signOut(loginPathFor(Router.asPath, "expired")).catch(() => undefined);
});

const refetchSession = (): Promise<void> =>
   Promise.resolve(sessionAtom?.get().refetch?.()).then(() => undefined);

export {
   authClient,
   changePassword,
   continueWithPassword,
   deleteAccount,
   hasPassword,
   isSigningOut,
   listSessions,
   refetchSession,
   requestPasswordReset,
   requestSignOut,
   resetPassword,
   revokeOtherSessions,
   revokeSession,
   sendVerificationCode,
   setPassword,
   signInWithGithub,
   signOut,
   updateProfileName,
   verifyEmailCode,
};
