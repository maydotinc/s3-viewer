import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { PublicConfig, SignUpMode } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

type SignUpPolicyState = { mode: SignUpMode; domains: string[] };

type ConfigQuery = { data?: PublicConfig; isPending: boolean };

type EncryptionState = "loading" | "error" | "insecure" | "ready";

type EmailState = "loading" | "disabled" | "enabled";

const CONFIG_ERROR =
   "Couldn't load this instance's settings. Reload the page and try again.";

const INSECURE_CONTEXT_ERROR =
   "Credentials can only be encrypted over HTTPS. Open this app over https:// or on localhost to connect a server.";

const ENCRYPTION_ERROR = "Couldn't encrypt the credentials in this browser";

const RETRIES = 3;

const usePublicConfig = () =>
   useQuery({
      queryKey: queryKeys.instanceConfig,
      queryFn: () => api.get<PublicConfig>("/config"),
      staleTime: Infinity,
      gcTime: Infinity,
      retry: RETRIES,
      retryOnMount: true,
   });

const githubEnabled = (config: PublicConfig | undefined): boolean =>
   config?.githubLoginEnabled === true;

const emailState = ({ data, isPending }: ConfigQuery): EmailState => {
   if (data) return data.emailEnabled ? "enabled" : "disabled";
   return isPending ? "loading" : "enabled";
};

const signUpPolicyState = (
   config: PublicConfig | undefined
): SignUpPolicyState => ({
   mode: config?.signUpMode ?? "open",
   domains: config?.allowedEmailDomains ?? [],
});

const encryptionSupported = (): boolean =>
   typeof window === "undefined" ||
   (window.isSecureContext === true &&
      typeof window.crypto?.subtle?.encrypt === "function");

const encryptionState = ({ data, isPending }: ConfigQuery): EncryptionState => {
   if (!encryptionSupported()) return "insecure";
   return data?.encryptionPublicKey ? "ready" : isPending ? "loading" : "error";
};

const encryptionNotice = (state: EncryptionState): string | null =>
   state === "insecure"
      ? INSECURE_CONTEXT_ERROR
      : state === "error"
        ? CONFIG_ERROR
        : null;

export default usePublicConfig;
export {
   ENCRYPTION_ERROR,
   emailState,
   encryptionNotice,
   encryptionState,
   githubEnabled,
   signUpPolicyState,
};
export type { EncryptionState };
