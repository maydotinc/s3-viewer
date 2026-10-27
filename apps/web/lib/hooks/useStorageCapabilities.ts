import useSessionServer from "@/lib/hooks/queries/server/useSessionServer";
import type { StorageCapabilities } from "@s3-viewer/shared";
import { useMemo } from "react";

type ResolvedCapabilities = StorageCapabilities & { pending: boolean };

const UNAVAILABLE: StorageCapabilities = {
   writable: false,
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
   const { currentServer, isLoading } = useSessionServer();
   const capabilities = currentServer?.capabilities;
   return useMemo(() => {
      if (isLoading) return PENDING;
      return { ...(capabilities ?? UNAVAILABLE), pending: false };
   }, [capabilities, isLoading]);
};

export { useStorageCapabilities };
