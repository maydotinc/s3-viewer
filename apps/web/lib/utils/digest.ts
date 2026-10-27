// cyrb53: a fast 53-bit string hash for cache keys, not for anything security-sensitive
const hash53 = (text: string): number => {
   let h1 = 0xdeadbeef;
   let h2 = 0x41c6ce57;
   for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 2654435761);
      h2 = Math.imul(h2 ^ code, 1597334677);
   }
   h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
   h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
   h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
   h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
   return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

const textDigest = (text: string): string =>
   `${text.length.toString(36)}-${hash53(text).toString(36)}`;

export { textDigest };
