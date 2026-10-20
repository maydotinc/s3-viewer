import { describe, expect, it } from "vitest";
import { Provider } from "@s3-viewer/types";
import { storageCapabilities } from "./storage-capabilities";

describe("provider capabilities returned to clients", () => {
   it.each([
      [Provider.S3, "https://s3.amazonaws.com", "conditional", null],
      [
         Provider.R2,
         "https://account.r2.cloudflarestorage.com",
         "checked",
         null,
      ],
      [
         Provider.Other,
         "https://s3.us-west-004.backblazeb2.com",
         "checked",
         "Conditional writes are not enforced by Backblaze B2; S3 Viewer checks before each write instead.",
      ],
      [Provider.Other, "https://minio.example.com", "checked", null],
   ] as const)(
      "reports %s at %s",
      (provider, endpoint, deleteProtection, notice) => {
         expect(storageCapabilities(provider, endpoint)).toEqual({
            writable: true,
            deleteProtection,
            notice,
         });
      }
   );
});
