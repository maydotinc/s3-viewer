import dns from "node:dns";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
   assertPublicEndpoint,
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

   it("flags the documentation IPv4 ranges", () => {
      for (const ip of ["192.0.2.1", "198.51.100.7", "203.0.113.255"]) {
         expect(isPrivateAddress(ip), ip).toBe(true);
      }
   });

   it("flags a 6to4 address whose embedded IPv4 is private", () => {
      for (const ip of [
         "2002:a9fe:a9fe::",
         "2002:a9fe:a9fe:1::1",
         "2002:7f00:1::",
         "2002:c0a8:101::",
         "[2002:a9fe:a9fe::]",
      ]) {
         expect(isPrivateAddress(ip), ip).toBe(true);
      }
      expect(isPrivateAddress("2002:808:808::")).toBe(false);
   });

   it("flags Teredo, which names a relay rather than its destination", () => {
      for (const ip of ["2001:0:4136:e378:8000:63bf:3fff:fdd2", "2001::1"]) {
         expect(isPrivateAddress(ip), ip).toBe(true);
      }
      expect(isPrivateAddress("2001:4860:4860::8888")).toBe(false);
   });

   it.each([
      ["Azure WireServer", "168.63.129.16"],
      ["the 6to4 relay anycast range", "192.88.99.1"],
      ["local-use NAT64", "64:ff9b:1::a00:1"],
      ["local-use NAT64 to a public address", "64:ff9b:1:ffff::808:808"],
      ["an IPv4-translated address", "::ffff:0:a00:1"],
      ["an IPv4-translated public address", "::ffff:0:808:808"],
      ["IPv6 documentation", "2001:db8::1"],
      ["IPv6 documentation, fully written", "2001:0db8:85a3::8a2e:370:7334"],
      ["IPv6 discard-only", "100::1"],
      ["IPv6 discard-only, last address", "100::ffff:ffff:ffff:ffff"],
   ])("flags %s (%s)", (_name, ip) => {
      expect(isPrivateAddress(ip)).toBe(true);
   });

   it.each([
      ["the address after WireServer", "168.63.129.17"],
      ["the address before WireServer", "168.63.129.15"],
      ["the network after the 6to4 relay range", "192.88.100.1"],
      ["a /64 neighbour of discard-only", "100:0:0:1::1"],
      ["the network after documentation", "2001:db9::1"],
   ])("still allows %s (%s)", (_name, ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
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
      expect(publicHostname("https://[2002:a9fe:a9fe::]/latest")).toBeNull();
      expect(publicHostname("https://[2001::1]")).toBeNull();
      expect(publicHostname("https://168.63.129.16")).toBeNull();
      expect(publicHostname("https://[::ffff:0:10.0.0.1]")).toBeNull();
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

describe("assertPublicEndpoint", () => {
   const answers = (v4: string[] | Error, v6: string[] | Error) => {
      const settle = (answer: string[] | Error) =>
         answer instanceof Error
            ? Promise.reject(answer)
            : Promise.resolve(answer);
      vi.spyOn(dns.promises.Resolver.prototype, "resolve4").mockImplementation(
         () => settle(v4) as never
      );
      vi.spyOn(dns.promises.Resolver.prototype, "resolve6").mockImplementation(
         () => settle(v6) as never
      );
   };
   const noData = () =>
      Object.assign(new Error("queryAaaa ENODATA"), { code: "ENODATA" });

   afterEach(() => vi.restoreAllMocks());

   it("accepts a name whose every address is public, whichever family has records", async () => {
      answers(["93.184.216.34"], noData());
      await expect(
         assertPublicEndpoint("https://s3.example.com")
      ).resolves.toBeUndefined();
      answers(noData(), ["2606:2800:220:1::1"]);
      await expect(
         assertPublicEndpoint("https://s3.example.com")
      ).resolves.toBeUndefined();
   });

   it("rejects a name with one private address in either family", async () => {
      answers(["93.184.216.34"], ["::1"]);
      await expect(
         assertPublicEndpoint("https://s3.example.com")
      ).rejects.toThrow(/public https URL/);
      answers(["10.0.0.5", "93.184.216.34"], noData());
      await expect(
         assertPublicEndpoint("https://s3.example.com")
      ).rejects.toThrow(/public https URL/);
   });

   it("rejects a name that does not resolve or whose name server fails", async () => {
      answers(noData(), noData());
      await expect(
         assertPublicEndpoint("https://s3.example.com")
      ).rejects.toThrow(/public https URL/);
      const timeout = Object.assign(new Error("queryA ETIMEOUT"), {
         code: "ETIMEOUT",
      });
      answers(timeout, timeout);
      await expect(
         assertPublicEndpoint("https://s3.example.com")
      ).rejects.toThrow(/public https URL/);
   });

   it("never uses the threadpool-backed lookup", async () => {
      answers(["93.184.216.34"], noData());
      const lookup = vi.spyOn(dns, "lookup");
      const promised = vi.spyOn(dns.promises, "lookup");
      await assertPublicEndpoint("https://s3.example.com");
      expect(lookup).not.toHaveBeenCalled();
      expect(promised).not.toHaveBeenCalled();
   });

   it("bounds each query with a timeout and a retry limit", async () => {
      const constructed = vi
         .spyOn(dns.promises, "Resolver")
         .mockImplementation(function () {
            return {};
         } as never);
      vi.resetModules();
      await import("./endpoint");
      expect(constructed).toHaveBeenCalledWith({ timeout: 3000, tries: 2 });
   });
});

describe("connect-time lookups of a name", () => {
   const resolveWith = (
      hostname: string,
      options: dns.LookupOptions = {}
   ): Promise<{
      err: NodeJS.ErrnoException | null;
      address: string | dns.LookupAddress[];
      family?: number;
   }> =>
      new Promise((resolve) =>
         publicOnlyLookup(hostname, options, (err, address, family) =>
            resolve({ err, address, family })
         )
      );
   const answering = (addresses: dns.LookupAddress[]) =>
      vi
         .spyOn(dns, "lookup")
         .mockImplementation(((
            _host: string,
            _options: unknown,
            callback: (
               err: Error | null,
               addresses: dns.LookupAddress[]
            ) => void
         ) => callback(null, addresses)) as never);

   afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
   });

   it("asks the system once per minute however many sockets open", async () => {
      vi.useFakeTimers();
      const lookup = answering([{ address: "93.184.216.34", family: 4 }]);
      for (let sockets = 0; sockets < 5; sockets++) {
         const { err, address, family } =
            await resolveWith("cached.example.com");
         expect(err).toBeNull();
         expect(address).toBe("93.184.216.34");
         expect(family).toBe(4);
      }
      expect(lookup).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(60_001);
      await resolveWith("cached.example.com");
      expect(lookup).toHaveBeenCalledTimes(2);
   });

   it("shares one lookup between sockets opening together", async () => {
      let answer: ((addresses: dns.LookupAddress[]) => void) | undefined;
      const lookup = vi.spyOn(dns, "lookup").mockImplementation(((
         _host: string,
         _options: unknown,
         callback: (err: null, addresses: dns.LookupAddress[]) => void
      ) => {
         answer = (addresses) => callback(null, addresses);
      }) as never);
      const all = Promise.all([
         resolveWith("together.example.com"),
         resolveWith("together.example.com"),
         resolveWith("together.example.com"),
      ]);
      answer?.([{ address: "93.184.216.34", family: 4 }]);
      const results = await all;
      expect(results.every(({ err }) => err === null)).toBe(true);
      expect(lookup).toHaveBeenCalledTimes(1);
   });

   it("refuses a name with any private address and remembers the refusal briefly", async () => {
      const lookup = answering([
         { address: "93.184.216.34", family: 4 },
         { address: "10.0.0.5", family: 4 },
      ]);
      for (let sockets = 0; sockets < 3; sockets++) {
         const { err } = await resolveWith("rebind.example.com");
         expect(err?.code).toBe(PRIVATE_ADDRESS_CODE);
      }
      expect(lookup).toHaveBeenCalledTimes(1);
   });

   it("stops waiting for a name server that never answers", async () => {
      vi.useFakeTimers();
      const lookup = vi
         .spyOn(dns, "lookup")
         .mockImplementation((() => undefined) as never);
      const pending = resolveWith("tarpit.example.com");
      const again = resolveWith("tarpit.example.com");
      await vi.advanceTimersByTimeAsync(5000);
      expect((await pending).err?.code).toBe("ETIMEOUT");
      expect((await again).err?.code).toBe("ETIMEOUT");
      expect(lookup).toHaveBeenCalledTimes(1);
      expect((await resolveWith("tarpit.example.com")).err?.code).toBe(
         "ETIMEOUT"
      );
      expect(lookup).toHaveBeenCalledTimes(1);
   });

   it("answers the family and shape the socket asked for", async () => {
      answering([
         { address: "2606:2800:220:1::1", family: 6 },
         { address: "93.184.216.34", family: 4 },
      ]);
      const v4 = await resolveWith("shapes.example.com", { family: 4 });
      expect(v4.address).toBe("93.184.216.34");
      const v6 = await resolveWith("shapes.example.com", { family: 6 });
      expect(v6.address).toBe("2606:2800:220:1::1");
      const all = await resolveWith("shapes.example.com", { all: true });
      expect(all.address).toHaveLength(2);
      answering([{ address: "93.184.216.34", family: 4 }]);
      const none = await resolveWith("v4only.example.com", { family: 6 });
      expect(none.err?.code).toBe("ENOTFOUND");
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

describe("effective cleartext capability", () => {
   it.each([
      { mode: "production", optIn: "", expected: false },
      { mode: "production", optIn: "true", expected: true },
      { mode: "development", optIn: "", expected: true },
      { mode: "test", optIn: "", expected: true },
   ])(
      "matches the endpoint protocol policy in $mode with opt-in $optIn",
      async ({ mode, optIn, expected }) => {
         process.env.NODE_ENV = mode;
         process.env.ALLOW_PRIVATE_ENDPOINTS = optIn;
         vi.resetModules();
         const { allowsInsecureEndpoints, publicHostname } = await import(
            "./endpoint"
         );
         expect(allowsInsecureEndpoints()).toBe(expected);
         expect(publicHostname("http://storage.example.com")).toBe(
            expected ? "storage.example.com" : null
         );
      }
   );
});
