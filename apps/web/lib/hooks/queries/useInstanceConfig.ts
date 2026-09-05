import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

type InstanceConfig = {
   encryptionPublicKey: string;
   githubLoginEnabled: boolean;
   emailEnabled: boolean;
};

type ConfigQuery = { data?: InstanceConfig; isPending: boolean };

type EncryptionState = "loading" | "error" | "ready";

type EmailState = "loading" | "disabled" | "enabled";

const CONFIG_ERROR =
   "Couldn't load this instance's settings. Reload the page and try again.";

const RETRIES = 3;

// what this install can do never changes while the tab is open, so it is
// fetched once and shared by every surface that has to gate on it
const useInstanceConfig = () =>
   useQuery({
      queryKey: queryKeys.instanceConfig,
      queryFn: () => api.get<InstanceConfig>("/config"),
      staleTime: Infinity,
      gcTime: Infinity,
      retry: RETRIES,
      retryOnMount: true,
   });

// each gate is a positive fact from the api: while the config is loading
// nothing is claimed, so no feature flashes in and then out
const githubEnabled = (config: InstanceConfig | undefined): boolean =>
   config?.githubLoginEnabled === true;

// "loading" is its own answer so callers can hold the space instead of
// guessing; a config we could never fetch falls back to "enabled", because
// hiding the email features of a working instance is the worse failure
const emailState = ({ data, isPending }: ConfigQuery): EmailState => {
   if (data) return data.emailEnabled ? "enabled" : "disabled";
   return isPending ? "loading" : "enabled";
};

const encryptionState = ({ data, isPending }: ConfigQuery): EncryptionState =>
   data?.encryptionPublicKey ? "ready" : isPending ? "loading" : "error";

export default useInstanceConfig;
export { CONFIG_ERROR, emailState, encryptionState, githubEnabled };
export type { EmailState, EncryptionState, InstanceConfig };
