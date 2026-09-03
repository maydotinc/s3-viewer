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

const startAuthFlow = (email: string): Promise<void> =>
   api.post<void>("/auth-flow/start", { email });

const signOut = async (): Promise<void> => {
   await endSession();
   clearQueryCache();
   useSessionStore.getState().clearSession();
   await Router.replace(SITE_PATHS.login);
};

export { authClient, signInWithGithub, signOut, startAuthFlow, verifyOtp };
