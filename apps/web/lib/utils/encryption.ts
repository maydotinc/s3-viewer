import type { ServerCredentials } from "@s3-viewer/types";

const AES_KEY_BITS = 256;
const GCM_IV_BYTES = 12;

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string =>
   btoa(String.fromCharCode(...new Uint8Array(bytes)));

const pemToDer = (pem: string): Uint8Array =>
   Uint8Array.from(
      atob(pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s/g, "")),
      (c) => c.charCodeAt(0)
   );

const importPublicKey = (pem: string): Promise<CryptoKey> =>
   crypto.subtle.importKey(
      "spki",
      pemToDer(pem),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
   );

const encryptCredentials = async (
   credentials: ServerCredentials,
   publicKeyPem: string
): Promise<string> => {
   const publicKey = await importPublicKey(publicKeyPem);
   const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: AES_KEY_BITS },
      true,
      ["encrypt"]
   );
   const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
   const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      new TextEncoder().encode(JSON.stringify(credentials))
   );
   const k = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      await crypto.subtle.exportKey("raw", aesKey)
   );

   return btoa(
      JSON.stringify({
         v: 1,
         k: toBase64(k),
         iv: toBase64(iv),
         ct: toBase64(ct),
      })
   );
};

export { encryptCredentials };
