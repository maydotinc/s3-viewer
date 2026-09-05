import { afterEach, describe, expect, it, vi } from "vitest";
import {
   isPrivateAddress,
   PRIVATE_ADDRESS_CODE,
   publicHostname,
   publicOnlyLookup,
} from "./endpoint";

const originalEnv = process.env.NODE_ENV;
afterEach(() => {
   process.env.NODE_ENV = originalEnv;
   process.env.ALLOW_PRIVATE_ENDPOINTS = "";
   vi.resetModules();
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
         "64:ff9b::7f00:1",
         "ff02::1",
      ]) {
         expect(isPrivateAddress(ip), ip).toBe(true);
      }
   });

   it("flags an IPv4-mapped address written in hex rather than dotted form", () => {
      for (const ip of [
         "::ffff:7f00:1",
         "::ffff:7f00:0001",
         "0:0:0:0:0:ffff:7f00:0001",
         "0000:0000:0000:0000:0000:ffff:a9fe:a9fe",
         "::ffff:a9fe:a9fe",
         "::ffff:c0a8:1",
         "[::ffff:7f00:1]",
      ]) {
         expect(isPrivateAddress(ip), ip).toBe(true);
      }
   });

   it("flags an IPv4-compatible address, which new URL() rewrites to hex", () => {
      for (const ip of [
         "::127.0.0.1",
         "::7f00:1",
         "::a9fe:a9fe",
         "::169.254.169.254",
         "::10.0.0.1",
      ]) {
         expect(isPrivateAddress(ip), ip).toBe(true);
      }
   });

   it("allows public IPv6 and rejects garbage", () => {
      expect(isPrivateAddress("2606:4700::1111")).toBe(false);
      expect(isPrivateAddress("2001:db8::1")).toBe(false);
      expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
      expect(isPrivateAddress("::ffff:808:808")).toBe(false);
      expect(isPrivateAddress("1.1.1.1")).toBe(false);
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

   it("allows http only in development and test", () => {
      process.env.NODE_ENV = "development";
      expect(publicHostname("http://example.com")).toBe("example.com");
      process.env.NODE_ENV = "test";
      expect(publicHostname("http://example.com")).toBe("example.com");
      process.env.NODE_ENV = "production";
      expect(publicHostname("http://example.com")).toBeNull();
   });

   it("rejects http when NODE_ENV is unset or unrecognised", () => {
      delete process.env.NODE_ENV;
      expect(publicHostname("http://example.com")).toBeNull();
      expect(publicHostname("https://example.com")).toBe("example.com");
      process.env.NODE_ENV = "staging";
      expect(publicHostname("http://example.com")).toBeNull();
   });

   it("rejects localhost and private IP literals", () => {
      expect(publicHostname("https://localhost")).toBeNull();
      expect(publicHostname("https://api.localhost")).toBeNull();
      expect(publicHostname("https://127.0.0.1")).toBeNull();
      expect(publicHostname("https://[::1]")).toBeNull();
      expect(publicHostname("https://0x7f.1")).toBeNull();
      expect(publicHostname("https://169.254.169.254/latest")).toBeNull();
      expect(publicHostname("https://[::ffff:7f00:1]")).toBeNull();
      expect(publicHostname("https://[::ffff:a9fe:a9fe]/latest")).toBeNull();
      expect(publicHostname("https://[::127.0.0.1]")).toBeNull();
      expect(publicHostname("https://[0:0:0:0:0:ffff:7f00:0001]")).toBeNull();
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

describe("ALLOW_PRIVATE_ENDPOINTS", () => {
   const load = async (allow: string, nodeEnv = "test") => {
      process.env.ALLOW_PRIVATE_ENDPOINTS = allow;
      process.env.NODE_ENV = nodeEnv;
      vi.resetModules();
      return import("./endpoint");
   };

   it("accepts localhost, LAN addresses and cleartext when true", async () => {
      const endpoint = await load("true", "production");
      expect(endpoint.publicHostname("http://localhost:9000")).toBe(
         "localhost"
      );
      expect(endpoint.publicHostname("http://minio.localhost:9000")).toBe(
         "minio.localhost"
      );
      expect(endpoint.publicHostname("http://192.168.1.10:9000")).toBe(
         "192.168.1.10"
      );
      expect(endpoint.publicHostname("http://127.0.0.1:9000")).toBe(
         "127.0.0.1"
      );
      expect(endpoint.publicHostname("https://s3.example.com")).toBe(
         "s3.example.com"
      );
   });

   it("still rejects what is not an http(s) URL at all when true", async () => {
      const endpoint = await load("true");
      expect(endpoint.publicHostname("nope")).toBeNull();
      expect(endpoint.publicHostname("ftp://192.168.1.10")).toBeNull();
      expect(endpoint.publicHostname("file:///etc/passwd")).toBeNull();
   });

   it("keeps the default rejections when false", async () => {
      const endpoint = await load("", "production");
      expect(endpoint.publicHostname("http://localhost:9000")).toBeNull();
      expect(endpoint.publicHostname("http://192.168.1.10:9000")).toBeNull();
      expect(endpoint.publicHostname("https://192.168.1.10:9000")).toBeNull();
      expect(endpoint.publicHostname("http://s3.example.com")).toBeNull();
      expect(endpoint.publicHostname("https://s3.example.com")).toBe(
         "s3.example.com"
      );
   });

   it("lets a private endpoint through assertPublicEndpoint only when true", async () => {
      const allowed = await load("true");
      await expect(
         allowed.assertPublicEndpoint("http://192.168.1.10:9000")
      ).resolves.toBeUndefined();

      const blocked = await load("");
      await expect(
         blocked.assertPublicEndpoint("http://192.168.1.10:9000")
      ).rejects.toThrow(/public https URL/);
   });

   it("lets the connect-time lookup resolve a private address only when true", async () => {
      const lookup = (module: typeof import("./endpoint"), hostname: string) =>
         new Promise<NodeJS.ErrnoException | null>((resolve) => {
            module.publicOnlyLookup(hostname, {}, (err) => resolve(err));
         });

      const allowed = await load("true");
      expect(await lookup(allowed, "127.0.0.1")).toBeNull();

      const blocked = await load("");
      expect((await lookup(blocked, "127.0.0.1"))?.code).toBe(
         blocked.PRIVATE_ADDRESS_CODE
      );
   });
});
