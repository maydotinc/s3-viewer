import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import type { StorageCapabilities } from "@s3-viewer/types";
import { useMemo } from "react";

type ResolvedCapabilities = StorageCapabilities & { pending: boolean };

const UNAVAILABLE: StorageCapabilities = {
   upload: false,
   replace: false,
   rename: false,
   delete: false,
   deleteProtection: null,
   notice:
      "Storage capabilities are unavailable. Refresh before changing files.",
};

const PENDING: ResolvedCapabilities = {
   ...UNAVAILABLE,
   notice: null,
   pending: true,
};

const useStorageCapabilities = (): ResolvedCapabilities => {
   const { currentServer, isLoading } = useCurrentServer();
   const capabilities = currentServer?.capabilities;
   return useMemo(() => {
      if (isLoading) return PENDING;
      return { ...(capabilities ?? UNAVAILABLE), pending: false };
   }, [capabilities, isLoading]);
};

export { useStorageCapabilities };
