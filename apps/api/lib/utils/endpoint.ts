import { ApiHttpError } from "@/lib/http";
import dns from "node:dns";
import { isIP, type LookupFunction } from "node:net";

const REJECTION = "Endpoint must be a public https URL";

const NON_PUBLIC_V4_CIDRS = [
   "0.0.0.0/8",
   "10.0.0.0/8",
   "100.64.0.0/10",
   "127.0.0.0/8",
   "169.254.0.0/16",
   "172.16.0.0/12",
   "192.0.0.0/24",
   "192.168.0.0/16",
   "198.18.0.0/15",
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

const v6Groups = (ip: string): number[] => {
   const [head = "", tail = ""] = ip.split("::");
   const parse = (s: string) =>
      s ? s.split(":").map((h) => parseInt(h, 16)) : [];
   const left = parse(head);
   const right = parse(tail);
   const fill = ip.includes("::")
      ? Array<number>(8 - left.length - right.length).fill(0)
      : [];
   return [...left, ...fill, ...right];
};

const mappedV4 = (ip: string): string | null => {
   const match = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
   return match?.[1] ?? null;
};

const isUnspecifiedV6 = (groups: number[]): boolean =>
   groups.every((x) => x === 0);

const isLoopbackV6 = (groups: number[]): boolean =>
   groups.slice(0, 7).every((x) => x === 0) && groups[7] === 1;

const isUniqueLocalV6 = (first: number): boolean => (first & 0xfe00) === 0xfc00;

const isLinkLocalV6 = (first: number): boolean => (first & 0xffc0) === 0xfe80;

const isSiteLocalV6 = (first: number): boolean => (first & 0xffc0) === 0xfec0;

const isNat64V6 = (groups: number[]): boolean =>
   groups[0] === 0x0064 && groups[1] === 0xff9b;

const isMulticastV6 = (first: number): boolean => (first & 0xff00) === 0xff00;

const isPrivateV6 = (ip: string): boolean => {
   const mapped = mappedV4(ip);
   if (mapped) return isPrivateV4(mapped);
   const groups = v6Groups(ip);
   const first = groups[0] ?? 0;
   return (
      isUnspecifiedV6(groups) ||
      isLoopbackV6(groups) ||
      isUniqueLocalV6(first) ||
      isLinkLocalV6(first) ||
      isSiteLocalV6(first) ||
      isNat64V6(groups) ||
      isMulticastV6(first)
   );
};

const ANYTHING_THAT_IS_NOT_AN_IP_ADDRESS_IS_UNSAFE = true;

const isPrivateAddress = (ip: string): boolean => {
   const bare = ip.replace(/^\[|\]$/g, "").split("%")[0] ?? "";
   const version = isIP(bare);
   if (version === 4) return isPrivateV4(bare);
   if (version === 6) return isPrivateV6(bare);
   return ANYTHING_THAT_IS_NOT_AN_IP_ADDRESS_IS_UNSAFE;
};

const allowedProtocols = (): readonly string[] =>
   process.env.NODE_ENV === "production" ? ["https:"] : ["https:", "http:"];

const publicHostname = (endpoint: string): string | null => {
   let url: URL;
   try {
      url = new URL(endpoint);
   } catch {
      return null;
   }
   if (!allowedProtocols().includes(url.protocol)) return null;
   const host = url.hostname.toLowerCase();
   if (!host || host === "localhost" || host.endsWith(".localhost"))
      return null;
   if (isIP(host.replace(/^\[|\]$/g, "")) && isPrivateAddress(host))
      return null;
   return host;
};

const assertPublicEndpoint = async (endpoint: string): Promise<void> => {
   const host = publicHostname(endpoint);
   if (!host) throw new ApiHttpError(400, REJECTION);
   if (isIP(host.replace(/^\[|\]$/g, ""))) return;
   let addresses: dns.LookupAddress[];
   try {
      addresses = await dns.promises.lookup(host, { all: true });
   } catch {
      throw new ApiHttpError(400, REJECTION);
   }
   if (
      addresses.length === 0 ||
      addresses.some((a) => isPrivateAddress(a.address))
   ) {
      throw new ApiHttpError(400, REJECTION);
   }
};

const PRIVATE_ADDRESS_CODE = "EPRIVATEADDRESS";

const privateAddressError = (): NodeJS.ErrnoException => {
   const err = new Error(REJECTION) as NodeJS.ErrnoException;
   err.code = PRIVATE_ADDRESS_CODE;
   return err;
};

type DnsLookupCallback = (
   err: NodeJS.ErrnoException | null,
   address: string | dns.LookupAddress[],
   family: number
) => void;

const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
   const onLookup: DnsLookupCallback = (err, address, family) => {
      if (err) {
         callback(err, address, family);
         return;
      }
      const addresses = Array.isArray(address)
         ? address.map((a) => a.address)
         : [address];
      if (addresses.some(isPrivateAddress)) {
         callback(privateAddressError(), address, family);
         return;
      }
      callback(null, address, family);
   };
   dns.lookup(hostname, options as dns.LookupAllOptions, onLookup);
};

export {
   assertPublicEndpoint,
   isPrivateAddress,
   PRIVATE_ADDRESS_CODE,
   publicHostname,
   publicOnlyLookup,
};
