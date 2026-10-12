import { env } from "@/lib/env";
import { ApiHttpError } from "@/lib/http";
import dns from "node:dns";
import { isIP, type LookupFunction } from "node:net";

const REJECTION = "Endpoint must be a public https URL";

const RESOLVE_TIMEOUT_MS = 3000;
const RESOLVE_TRIES = 2;
const LOOKUP_TIMEOUT_MS = 5000;
const LOOKUP_TTL_MS = 60_000;
const LOOKUP_FAILURE_TTL_MS = 5000;
const LOOKUP_CACHE_MAX = 1000;

const NON_PUBLIC_V4_CIDRS = [
   "0.0.0.0/8",
   "10.0.0.0/8",
   "100.64.0.0/10",
   "127.0.0.0/8",
   "169.254.0.0/16",
   // Azure's WireServer answers instance metadata and agent calls on a public address.
   "168.63.129.16/32",
   "172.16.0.0/12",
   "192.0.0.0/24",
   "192.0.2.0/24",
   "192.88.99.0/24",
   "192.168.0.0/16",
   "198.18.0.0/15",
   "198.51.100.0/24",
   "203.0.113.0/24",
   "224.0.0.0/4",
   "240.0.0.0/4",
] as const;

const v4ToInt = (ip: string): number =>
   ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;

const parseCidr = (cidr: string): [number, number] => {
   const [address = "", prefixLength = ""] = cidr.split("/");
   return [v4ToInt(address), Number(prefixLength)];
};

const NON_PUBLIC_V4_BLOCKS: readonly [number, number][] =
   NON_PUBLIC_V4_CIDRS.map(parseCidr);

const inV4Block = (ip: number, [base, bits]: [number, number]): boolean =>
   bits === 0 || ip >>> (32 - bits) === base >>> (32 - bits);

const isPrivateV4 = (ip: string): boolean => {
   const n = v4ToInt(ip);
   return NON_PUBLIC_V4_BLOCKS.some((block) => inV4Block(n, block));
};

const DOTTED_TAIL = /\d+\.\d+\.\d+\.\d+$/;

const hexTail = (ip: string): string => {
   const match = DOTTED_TAIL.exec(ip);
   if (!match) return ip;
   const n = v4ToInt(match[0]);
   const groups = `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
   return `${ip.slice(0, match.index)}${groups}`;
};

const v6Groups = (ip: string): number[] => {
   const expanded = hexTail(ip);
   const [head = "", tail = ""] = expanded.split("::");
   const parse = (s: string) =>
      s ? s.split(":").map((h) => parseInt(h, 16)) : [];
   const left = parse(head);
   const right = parse(tail);
   const fill = expanded.includes("::")
      ? Array<number>(8 - left.length - right.length).fill(0)
      : [];
   return [...left, ...fill, ...right];
};

const holdsV4 = (groups: number[]): boolean =>
   groups.length === 8 &&
   groups.slice(0, 5).every((x) => x === 0) &&
   (groups[5] === 0xffff || groups[5] === 0);

const v4Of = (high = 0, low = 0): string =>
   [high >>> 8, high & 0xff, low >>> 8, low & 0xff].join(".");

const embeddedV4 = (groups: number[]): string => v4Of(groups[6], groups[7]);

const isUnspecifiedV6 = (groups: number[]): boolean =>
   groups.every((x) => x === 0);

const isLoopbackV6 = (groups: number[]): boolean =>
   groups.slice(0, 7).every((x) => x === 0) && groups[7] === 1;

const isUniqueLocalV6 = (first: number): boolean => (first & 0xfe00) === 0xfc00;

const isLinkLocalV6 = (first: number): boolean => (first & 0xffc0) === 0xfe80;

const isSiteLocalV6 = (first: number): boolean => (first & 0xffc0) === 0xfec0;

// the /32 covers both the well-known /96 and the local-use 64:ff9b:1::/48.
const isNat64V6 = (groups: number[]): boolean =>
   groups[0] === 0x0064 && groups[1] === 0xff9b;

// ::ffff:0:0:0/96 (IPv4-translated) reaches IPv4 through a SIIT translator.
const isTranslatedV4 = (groups: number[]): boolean =>
   groups.slice(0, 4).every((x) => x === 0) &&
   groups[4] === 0xffff &&
   groups[5] === 0;

const isDiscardOnlyV6 = (groups: number[]): boolean =>
   groups[0] === 0x0100 && groups.slice(1, 4).every((x) => x === 0);

const isDocumentationV6 = (groups: number[]): boolean =>
   groups[0] === 0x2001 && groups[1] === 0x0db8;

const isMulticastV6 = (first: number): boolean => (first & 0xff00) === 0xff00;

// check 6to4's embedded IPv4 address to block private-address bypasses.
const is6to4V6 = (first: number): boolean => first === 0x2002;

const sixToFourV4 = (groups: number[]): string => v4Of(groups[1], groups[2]);

// Teredo hides the destination behind a relay; reject its entire prefix.
const isTeredoV6 = (groups: number[]): boolean =>
   groups[0] === 0x2001 && groups[1] === 0x0000;

const isPrivateV6 = (ip: string): boolean => {
   const groups = v6Groups(ip);
   if (holdsV4(groups)) return isPrivateV4(embeddedV4(groups));
   const first = groups[0] ?? 0;
   if (is6to4V6(first)) return isPrivateV4(sixToFourV4(groups));
   return (
      isUnspecifiedV6(groups) ||
      isLoopbackV6(groups) ||
      isUniqueLocalV6(first) ||
      isLinkLocalV6(first) ||
      isSiteLocalV6(first) ||
      isNat64V6(groups) ||
      isTranslatedV4(groups) ||
      isDiscardOnlyV6(groups) ||
      isDocumentationV6(groups) ||
      isTeredoV6(groups) ||
      isMulticastV6(first)
   );
};

const bareHost = (host: string): string => host.replace(/^\[|\]$/g, "");

const isPrivateAddress = (ip: string): boolean => {
   const bare = bareHost(ip).split("%")[0] ?? "";
   const version = isIP(bare);
   if (version === 4) return isPrivateV4(bare);
   if (version === 6) return isPrivateV6(bare);
   // anything that is not an IP literal is unsafe.
   return true;
};

const CLEARTEXT_ENVIRONMENTS: ReadonlySet<string> = new Set([
   "development",
   "test",
]);

const allowsInsecureEndpoints = (): boolean =>
   env.ALLOW_PRIVATE_ENDPOINTS ||
   CLEARTEXT_ENVIRONMENTS.has(process.env.NODE_ENV ?? "");

const allowedProtocols = (): readonly string[] =>
   allowsInsecureEndpoints() ? ["https:", "http:"] : ["https:"];

const publicHostname = (endpoint: string): string | null => {
   let url: URL;
   try {
      url = new URL(endpoint);
   } catch {
      return null;
   }
   if (!allowedProtocols().includes(url.protocol)) return null;
   const host = url.hostname.toLowerCase();
   if (!host) return null;
   if (env.ALLOW_PRIVATE_ENDPOINTS) return host;
   if (host === "localhost" || host.endsWith(".localhost")) return null;
   if (isIP(bareHost(host)) && isPrivateAddress(host)) return null;
   return host;
};

// c-ares answers asynchronously, so a hostile name server cannot pin libuv's small threadpool the way getaddrinfo can.
const resolver = new dns.promises.Resolver({
   timeout: RESOLVE_TIMEOUT_MS,
   tries: RESOLVE_TRIES,
});

const resolveAddresses = async (host: string): Promise<string[]> => {
   const answers = await Promise.allSettled([
      resolver.resolve4(host),
      resolver.resolve6(host),
   ]);
   const found = answers.flatMap((answer) =>
      answer.status === "fulfilled" ? answer.value : []
   );
   if (found.length > 0) return found;
   const failed = answers.find((answer) => answer.status === "rejected");
   throw failed?.reason ?? new Error("No addresses");
};

const assertPublicEndpoint = async (endpoint: string): Promise<void> => {
   const host = publicHostname(endpoint);
   if (!host) throw new ApiHttpError(400, REJECTION);
   if (env.ALLOW_PRIVATE_ENDPOINTS || isIP(bareHost(host))) return;
   let addresses: string[];
   try {
      addresses = await resolveAddresses(host);
   } catch {
      throw new ApiHttpError(400, REJECTION);
   }
   if (addresses.some(isPrivateAddress)) {
      throw new ApiHttpError(400, REJECTION);
   }
};

const PRIVATE_ADDRESS_CODE = "EPRIVATEADDRESS";

const privateAddressError = (): NodeJS.ErrnoException => {
   const err = new Error(REJECTION) as NodeJS.ErrnoException;
   err.code = PRIVATE_ADDRESS_CODE;
   return err;
};

const lookupError = (code: string, hostname: string): NodeJS.ErrnoException =>
   Object.assign(new Error(`getaddrinfo ${code} ${hostname}`), {
      code,
      hostname,
      syscall: "getaddrinfo",
   });

type Lookup = { result: dns.LookupAddress[] | Error; expiresAt: number };

const lookups = new Map<string, Lookup>();
const lookupsInFlight = new Map<string, Promise<dns.LookupAddress[]>>();

const remember = (hostname: string, result: Lookup["result"]): void => {
   if (lookups.size >= LOOKUP_CACHE_MAX) {
      const now = Date.now();
      for (const [known, { expiresAt }] of lookups)
         if (expiresAt <= now) lookups.delete(known);
      // map order is insertion order, so the first key is the oldest.
      if (lookups.size >= LOOKUP_CACHE_MAX)
         lookups.delete(lookups.keys().next().value!);
   }
   lookups.set(hostname, {
      result,
      expiresAt:
         Date.now() +
         (result instanceof Error ? LOOKUP_FAILURE_TTL_MS : LOOKUP_TTL_MS),
   });
};

const systemLookup = (hostname: string): Promise<dns.LookupAddress[]> =>
   new Promise((resolve, reject) => {
      // getaddrinfo cannot be cancelled and keeps its threadpool thread until it returns; give up waiting instead.
      const timer = setTimeout(
         () => reject(lookupError("ETIMEOUT", hostname)),
         LOOKUP_TIMEOUT_MS
      );
      timer.unref();
      dns.lookup(hostname, { all: true }, (err, addresses) => {
         clearTimeout(timer);
         if (err) reject(err);
         else resolve(addresses);
      });
   });

// every new socket resolves its host, so remember answers briefly and share one lookup between concurrent sockets.
const lookupAll = (hostname: string): Promise<dns.LookupAddress[]> => {
   const known = lookups.get(hostname);
   if (known && known.expiresAt > Date.now())
      return known.result instanceof Error
         ? Promise.reject(known.result)
         : Promise.resolve(known.result);
   const shared = lookupsInFlight.get(hostname);
   if (shared) return shared;
   const fresh = systemLookup(hostname)
      .then((addresses) => {
         if (
            !env.ALLOW_PRIVATE_ENDPOINTS &&
            addresses.some((a) => isPrivateAddress(a.address))
         )
            throw privateAddressError();
         remember(hostname, addresses);
         return addresses;
      })
      .catch((error: unknown) => {
         const failure =
            error instanceof Error ? error : new Error(String(error));
         remember(hostname, failure);
         throw failure;
      })
      .finally(() => lookupsInFlight.delete(hostname));
   lookupsInFlight.set(hostname, fresh);
   return fresh;
};

const wantedFamily = (family: dns.LookupOptions["family"]): 0 | 4 | 6 =>
   family === 4 || family === "IPv4"
      ? 4
      : family === 6 || family === "IPv6"
        ? 6
        : 0;

const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
   const literal = isIP(hostname);
   const answered = literal
      ? Promise.resolve([{ address: hostname, family: literal }])
      : lookupAll(hostname);
   answered.then(
      (addresses) => {
         if (
            literal &&
            !env.ALLOW_PRIVATE_ENDPOINTS &&
            isPrivateAddress(hostname)
         ) {
            callback(privateAddressError(), "", 0);
            return;
         }
         const family = wantedFamily(options.family);
         const matching = addresses.filter(
            (a) => family === 0 || a.family === family
         );
         const [first] = matching;
         if (!first) {
            callback(lookupError("ENOTFOUND", hostname), "", 0);
         } else if (options.all) {
            callback(null, matching, 0);
         } else {
            callback(null, first.address, first.family);
         }
      },
      (error: NodeJS.ErrnoException) => callback(error, "", 0)
   );
};

export {
   PRIVATE_ADDRESS_CODE,
   allowsInsecureEndpoints,
   assertPublicEndpoint,
   isPrivateAddress,
   publicHostname,
   publicOnlyLookup,
};
