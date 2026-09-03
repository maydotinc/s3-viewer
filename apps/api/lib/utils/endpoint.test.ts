import { afterEach, describe, expect, it } from "vitest";
import {
   isPrivateAddress,
   PRIVATE_ADDRESS_CODE,
   publicHostname,
   publicOnlyLookup,
} from "./endpoint";

const originalEnv = process.env.NODE_ENV;
afterEach(() => {
   process.env.NODE_ENV = originalEnv;
});

describe("isPrivateAddress", () => {
   it("flags loopback, private, link-local and reserved IPv4", () => {
      for (const ip of [
         "127.0.0.1",
         "10.1.2.3",
         "172.16.0.1",
         "172.31.255.255",
         "192.168.1.1",
         "169.254.169.254",
         "100.64.0.1",
         "0.0.0.0",
         "224.0.0.1",
         "255.255.255.255",
      ]) {
         expect(isPrivateAddress(ip), ip).toBe(true);
      }
   });

   it("allows public IPv4", () => {
      for (const ip of ["8.8.8.8", "172.32.0.1", "52.216.0.1", "1.1.1.1"]) {
         expect(isPrivateAddress(ip), ip).toBe(false);
      }
   });

   it("flags loopback, unique-local, link-local and mapped-private IPv6", () => {
      for (const ip of [
         "::1",
         "::",
         "fc00::1",
         "fd12:3456::1",
         "fe80::1",
         "fe80::1%eth0",
         "[::1]",
         "::ffff:127.0.0.1",
         "::ffff:10.0.0.1",
         "64:ff9b::a00:1",
         "ff02::1",
      ]) {
         expect(isPrivateAddress(ip), ip).toBe(true);
      }
   });

   it("allows public IPv6 and rejects garbage", () => {
      expect(isPrivateAddress("2606:4700::1111")).toBe(false);
      expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
      expect(isPrivateAddress("not-an-ip")).toBe(true);
   });
});

describe("publicHostname", () => {
   it("returns the lowercase host for https URLs", () => {
      expect(publicHostname("https://S3.Example.com/x")).toBe("s3.example.com");
   });

   it("rejects invalid URLs and non-http protocols", () => {
      expect(publicHostname("nope")).toBeNull();
      expect(publicHostname("ftp://example.com")).toBeNull();
      expect(publicHostname("file:///etc/passwd")).toBeNull();
   });

   it("allows http only outside production", () => {
      process.env.NODE_ENV = "development";
      expect(publicHostname("http://example.com")).toBe("example.com");
      process.env.NODE_ENV = "production";
      expect(publicHostname("http://example.com")).toBeNull();
   });

   it("rejects localhost and private IP literals", () => {
      expect(publicHostname("https://localhost")).toBeNull();
      expect(publicHostname("https://api.localhost")).toBeNull();
      expect(publicHostname("https://127.0.0.1")).toBeNull();
      expect(publicHostname("https://[::1]")).toBeNull();
      expect(publicHostname("https://0x7f.1")).toBeNull();
      expect(publicHostname("https://169.254.169.254/latest")).toBeNull();
   });

   it("allows public IP literals", () => {
      expect(publicHostname("https://8.8.8.8")).toBe("8.8.8.8");
   });
});

describe("publicOnlyLookup", () => {
   const lookup = (
      hostname: string
   ): Promise<{
      err: NodeJS.ErrnoException | null;
      address: string | undefined;
   }> =>
      new Promise((resolve) => {
         publicOnlyLookup(hostname, {}, (err, address) => {
            resolve({
               err,
               address: Array.isArray(address) ? undefined : address,
            });
         });
      });

   it("rejects a private address at connect time, even though it skipped a real DNS query", async () => {
      const { err } = await lookup("127.0.0.1");
      expect(err?.code).toBe(PRIVATE_ADDRESS_CODE);
   });

   it("allows a public IP literal through", async () => {
      const { err, address } = await lookup("8.8.8.8");
      expect(err).toBeNull();
      expect(address).toBe("8.8.8.8");
   });
});
