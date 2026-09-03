import { Provider } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { detectProvider } from "./detect-provider";

describe("detectProvider", () => {
   it("matches AWS by hostname suffix", () => {
      expect(detectProvider("https://s3.us-east-1.amazonaws.com")).toBe(
         Provider.S3
      );
      expect(detectProvider("https://S3.AMAZONAWS.COM/path")).toBe(Provider.S3);
   });

   it("matches Cloudflare R2", () => {
      expect(detectProvider("https://abc123.r2.cloudflarestorage.com")).toBe(
         Provider.R2
      );
   });

   it("does not match substrings outside the hostname", () => {
      expect(detectProvider("https://evil.com/amazonaws.com")).toBe(
         Provider.Other
      );
      expect(detectProvider("https://amazonaws.com.evil.com")).toBe(
         Provider.Other
      );
      expect(detectProvider("https://notamazonaws.com")).toBe(Provider.Other);
   });

   it("returns Other for unknown hosts and invalid URLs", () => {
      expect(detectProvider("https://minio.example.com")).toBe(Provider.Other);
      expect(detectProvider("not a url")).toBe(Provider.Other);
      expect(detectProvider("")).toBe(Provider.Other);
   });
});
