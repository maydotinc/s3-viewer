import { Provider } from "@s3-viewer/shared";
import { describe, expect, it } from "vitest";
import { detectProvider } from "./detect-provider";

describe("detectProvider", () => {
   it("matches native AWS S3 service endpoints", () => {
      expect(detectProvider("https://s3.us-east-1.amazonaws.com")).toBe(
         Provider.S3
      );
      expect(detectProvider("https://S3.AMAZONAWS.COM/path")).toBe(Provider.S3);
   });

   it.each([
      "s3-us-west-2.amazonaws.com",
      "s3.dualstack.eu-west-1.amazonaws.com",
      "s3-fips.dualstack.us-gov-west-1.amazonaws.com",
      "s3.cn-north-1.amazonaws.com.cn",
   ])("matches the native endpoint %s", (host) => {
      expect(detectProvider(`https://${host}`)).toBe(Provider.S3);
   });

   it.each([
      "amazonaws.com",
      "ec2-203-0-113-10.compute-1.amazonaws.com",
      "api.execute-api.us-east-1.amazonaws.com",
      "custom.us-east-1.elb.amazonaws.com",
      "s3-website-us-east-1.amazonaws.com",
      "s3.amazonaws.com.evil.example",
   ])("does not grant S3 capabilities to %s", (host) => {
      expect(detectProvider(`https://${host}`)).toBe(Provider.Other);
   });

   it("matches Cloudflare R2", () => {
      expect(detectProvider("https://abc123.r2.cloudflarestorage.com")).toBe(
         Provider.R2
      );
      expect(detectProvider("https://abc123.eu.r2.cloudflarestorage.com")).toBe(
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
