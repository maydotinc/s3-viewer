import {
   Provider,
   backblazeRegion,
   type StorageCapabilities,
} from "@s3-viewer/types";

const B2_NOTICE =
   "Conditional writes are not enforced by Backblaze B2; S3 Viewer checks before each write instead.";

const storageCapabilities = (
   provider: Provider,
   endpoint?: string
): StorageCapabilities => ({
   upload: true,
   replace: true,
   rename: true,
   delete: true,
   deleteProtection: provider === Provider.S3 ? "conditional" : "checked",
   notice:
      provider === Provider.Other && endpoint && backblazeRegion(endpoint)
         ? B2_NOTICE
         : null,
});

export { storageCapabilities };
