import useServers from "@/lib/hooks/queries/server/useServers";
import type { StorageCapabilities } from "@s3-viewer/types";

const UNAVAILABLE: StorageCapabilities = {
   upload: false,
   replace: false,
   rename: false,
   delete: false,
   notice:
      "Storage capabilities are unavailable. Refresh before changing files.",
};

const useStorageCapabilities = (): StorageCapabilities => {
   const { currentServer } = useServers();
   return currentServer?.capabilities ?? UNAVAILABLE;
};

export { useStorageCapabilities };
