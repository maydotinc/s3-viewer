import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { PublicConfig, SignUpMode } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

type SignUpPolicyState = { mode: SignUpMode; domains: string[] };

type ConfigQuery = {
   data?: PublicConfig;
   isPending: boolean;
   isPlaceholderData?: boolean;
};

type EncryptionState = "loading" | "error" | "insecure" | "ready";

type EmailState = "loading" | "disabled" | "enabled";

const CONFIG_ERROR =
   "Couldn't load this instance's settings. Reload the page and try again.";

const INSECURE_CONTEXT_ERROR =
   "Credentials can only be encrypted over HTTPS. Open this app over https:// or on localhost to connect a server.";

const ENCRYPTION_ERROR = "Couldn't encrypt the credentials in this browser";

const RETRIES = 3;

const CACHE_KEY = "instance-config";

// only what the auth screens paint before the fetch answers; the encryption key never comes from a cache
type CachedConfig = Pick<
   PublicConfig,
   "emailEnabled" | "githubLoginEnabled" | "signUpMode" | "allowedEmailDomains"
>;

let cached: PublicConfig | null | undefined;

const isCachedConfig = (value: unknown): value is CachedConfig =>
   typeof value === "object" &&
   value !== null &&
   typeof (value as CachedConfig).emailEnabled === "boolean" &&
   typeof (value as CachedConfig).githubLoginEnabled === "boolean" &&
   typeof (value as CachedConfig).signUpMode === "string" &&
   Array.isArray((value as CachedConfig).allowedEmailDomains);

const isPublicConfig = (value: unknown): value is PublicConfig =>
   isCachedConfig(value) &&
   typeof (value as PublicConfig).encryptionPublicKey === "string" &&
   typeof (value as PublicConfig).allowInsecureEndpoints === "boolean";

const placeholderFrom = ({
   emailEnabled,
   githubLoginEnabled,
   signUpMode,
   allowedEmailDomains,
}: CachedConfig): PublicConfig => ({
   emailEnabled,
   githubLoginEnabled,
   signUpMode,
   allowedEmailDomains,
   encryptionPublicKey: "",
   allowInsecureEndpoints: false,
});

// the config is static per deployment, so the last one seen stands in until the fresh copy lands.
const readCachedConfig = (): PublicConfig | undefined => {
   if (cached !== undefined) return cached ?? undefined;
   try {
      const parsed: unknown = JSON.parse(
         window.localStorage.getItem(CACHE_KEY) ?? "null"
      );
      cached = isCachedConfig(parsed) ? placeholderFrom(parsed) : null;
   } catch {
      cached = null;
   }
   return cached ?? undefined;
};

const cacheEntry = ({
   emailEnabled,
   githubLoginEnabled,
   signUpMode,
   allowedEmailDomains,
}: CachedConfig): CachedConfig => ({
   emailEnabled,
   githubLoginEnabled,
   signUpMode,
   allowedEmailDomains,
});

const rememberConfig = (config: PublicConfig): void => {
   const serialized = JSON.stringify(cacheEntry(config));
   if (cached && JSON.stringify(cacheEntry(cached)) === serialized) return;
   cached = placeholderFrom(config);
   try {
      window.localStorage.setItem(CACHE_KEY, serialized);
   } catch {
      // private mode or full storage: the next visit just fetches first
   }
};

const noSubscription = () => () => {};

const usePublicConfig = () => {
   // server markup never has the cache, so the client first renders without it and then adds it before painting
   const placeholderData = useSyncExternalStore(
      noSubscription,
      readCachedConfig,
      () => undefined
   );
   const query = useQuery({
      queryKey: queryKeys.instanceConfig,
      queryFn: () => api.get<PublicConfig>("/config"),
      placeholderData,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: RETRIES,
      retryOnMount: true,
   });
   // auth pages arrive with the config already seeded by the server, so the cache follows the data shown
   const { data, isPlaceholderData } = query;
   useEffect(() => {
      if (data && !isPlaceholderData) rememberConfig(data);
   }, [data, isPlaceholderData]);
   return query;
};

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

const encryptionState = ({
   data,
   isPending,
   isPlaceholderData,
}: ConfigQuery): EncryptionState => {
   if (!encryptionSupported()) return "insecure";
   if (isPlaceholderData) return "loading";
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
   isPublicConfig,
   signUpPolicyState,
};
export type { EmailState, EncryptionState };
