import { describe, expect, it } from "vitest";
import { Provider } from "@s3-viewer/types";
import { storageCapabilities } from "./storage-capabilities";

describe("provider capabilities returned to clients", () => {
   it.each([
      [Provider.S3, "https://s3.amazonaws.com", null],
      [Provider.R2, "https://account.r2.cloudflarestorage.com", null],
      [
         Provider.Other,
         "https://s3.us-west-004.backblazeb2.com",
         "Conditional writes are not enforced by Backblaze B2; S3 Viewer checks before each write instead.",
      ],
      [Provider.Other, "https://minio.example.com", null],
   ] as const)("reports %s at %s", (provider, endpoint, notice) => {
      expect(storageCapabilities(provider, endpoint)).toEqual({
         upload: true,
         replace: true,
         rename: true,
         delete: true,
         deleteProtection: provider === Provider.S3 ? "conditional" : "checked",
         notice,
      });
   });
});
