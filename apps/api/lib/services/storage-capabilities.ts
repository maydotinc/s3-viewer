import {
   Provider,
   backblazeRegion,
   type StorageCapabilities,
} from "@s3-viewer/types";

const storageCapabilities = (
   provider: Provider,
   endpoint?: string
): StorageCapabilities => {
   if (provider === Provider.S3)
      return {
         upload: true,
         replace: false,
         rename: false,
         delete: true,
         notice:
            "AWS supports browsing, downloads, new-file uploads and reviewed object deletion. Rename and replacing existing files are unavailable; use a new filename.",
      };
   if (provider === Provider.R2)
      return {
         upload: true,
         replace: true,
         rename: false,
         delete: true,
         notice:
            "Cloudflare R2 supports browsing, downloads, uploads and object deletion. Rename is currently unavailable.",
      };
   if (endpoint && backblazeRegion(endpoint))
      return {
         upload: false,
         replace: false,
         rename: false,
         delete: false,
         notice:
            "Backblaze B2 currently supports browsing and downloads. Upload, rename and object deletion are unavailable.",
      };
   return {
      upload: true,
      replace: false,
      rename: false,
      delete: false,
      notice:
         "Rename, replacement and object deletion are unavailable for this provider. New-file uploads require provider support for conditional writes.",
   };
};

export { storageCapabilities };
