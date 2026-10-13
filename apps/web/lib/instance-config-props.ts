import { publicEnv } from "@/lib/env";
import { isPublicConfig } from "@/lib/hooks/queries/useInstanceConfig";
import { queryKeys } from "@/lib/query-keys";
import type { PublicConfig } from "@s3-viewer/types";
import {
   QueryClient,
   dehydrate,
   type DehydratedState,
} from "@tanstack/react-query";
import type { GetServerSideProps } from "next";

type InstanceConfigProps = { dehydratedState?: DehydratedState };

// an api that doesn't answer in time leaves the client to fetch, as it did before
const TIMEOUT_MS = 1500;

const fetchPublicConfig = async (): Promise<PublicConfig | null> => {
   const origin = publicEnv.apiOrigin;
   if (!origin) return null;
   try {
      const res = await fetch(`${origin}/config`, {
         signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      return isPublicConfig(body) ? body : null;
   } catch {
      return null;
   }
};

// the auth screens paint differently per instance (github button, sign-up link), so the server
// fetches the config and seeds the query cache; the markup then matches the first client render
const getInstanceConfigProps: GetServerSideProps<
   InstanceConfigProps
> = async () => {
   const config = await fetchPublicConfig();
   if (!config) return { props: {} };
   const queryClient = new QueryClient();
   queryClient.setQueryData(queryKeys.instanceConfig, config);
   return { props: { dehydratedState: dehydrate(queryClient) } };
};

export { getInstanceConfigProps };
export type { InstanceConfigProps };
