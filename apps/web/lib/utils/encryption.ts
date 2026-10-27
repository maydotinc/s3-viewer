import {
   CREDENTIAL_AES_KEY_BITS,
   CREDENTIAL_ENVELOPE_VERSION,
   CREDENTIAL_GCM_IV_BYTES,
   type CredentialEnvelope,
   type ServerCredentials,
} from "@s3-viewer/shared";

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
   publicKeyPem: string,
   boundTo: string
): Promise<string> => {
   const publicKey = await importPublicKey(publicKeyPem);
   const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: CREDENTIAL_AES_KEY_BITS },
      true,
      ["encrypt"]
   );
   const iv = crypto.getRandomValues(new Uint8Array(CREDENTIAL_GCM_IV_BYTES));
   const ct = await crypto.subtle.encrypt(
      {
         name: "AES-GCM",
         iv,
         additionalData: new TextEncoder().encode(boundTo),
      },
      aesKey,
      new TextEncoder().encode(JSON.stringify(credentials))
   );
   const k = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      await crypto.subtle.exportKey("raw", aesKey)
   );

   const envelope: CredentialEnvelope = {
      v: CREDENTIAL_ENVELOPE_VERSION,
      k: toBase64(k),
      iv: toBase64(iv),
      ct: toBase64(ct),
   };
   return btoa(JSON.stringify(envelope));
};

export { encryptCredentials };
