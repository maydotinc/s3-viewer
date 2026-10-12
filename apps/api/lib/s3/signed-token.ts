import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const signer = (info: string) => {
   let key: Buffer | undefined;
   const sign = (body: string): string =>
      createHmac(
         "sha256",
         (key ??= Buffer.from(
            hkdfSync("sha256", env.BETTER_AUTH_SECRET, "", info, 32)
         ))
      )
         .update(body)
         .digest("base64url");
   return {
      sign,
      verify: (body: string, mac: string): boolean => {
         const given = Buffer.from(mac);
         const wanted = Buffer.from(sign(body));
         return (
            given.length === wanted.length && timingSafeEqual(given, wanted)
         );
      },
   };
};

export { signer };
