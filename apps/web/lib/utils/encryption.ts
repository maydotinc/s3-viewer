import { ServerCredentials } from "@s3-viewer/types";

async function importPublicKey(pemKey: string): Promise<CryptoKey> {
   const pemContents = pemKey
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\s/g, "");

   const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

   return await crypto.subtle.importKey(
      "spki",
      binaryDer,
      {
         name: "RSA-OAEP",
         hash: "SHA-256",
      },
      false,
      ["encrypt"]
   );
}

export async function encryptCredentials(
   credentials: ServerCredentials
): Promise<string> {
   const publicKeyPem = process.env.NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY;

   if (!publicKeyPem) {
      throw new Error(
         "Public encryption key not found in environment variables"
      );
   }

   try {
      const publicKey = await importPublicKey(publicKeyPem);

      const credentialsJson = JSON.stringify(credentials);
      const encoder = new TextEncoder();
      const data = encoder.encode(credentialsJson);

      const encryptedData = await crypto.subtle.encrypt(
         {
            name: "RSA-OAEP",
         },
         publicKey,
         data
      );

      const encryptedArray = new Uint8Array(encryptedData);
      return btoa(String.fromCharCode(...encryptedArray));
   } catch (error) {
      console.error(
         "Encryption failed, if your keys are set correctly, it is likely that the payload is too large for the key. Try using a larger key.",
         error
      );
      throw new Error("Failed to encrypt credentials");
   }
}
