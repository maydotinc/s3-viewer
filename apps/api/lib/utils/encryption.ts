import { ServerCredentials } from "@s3-viewer/types";
import crypto from "crypto";

function getPrivateKey(): string {
   const privateKey = process.env.ENCRYPTION_PRIVATE_KEY;

   if (!privateKey) {
      throw new Error(
         "Private encryption key not found in environment variables"
      );
   }

   return privateKey;
}

export function decryptCredentials(encryptedData: string): ServerCredentials {
   try {
      const privateKey = getPrivateKey();

      const encryptedBuffer = Buffer.from(encryptedData, "base64");

      const decryptedBuffer = crypto.privateDecrypt(
         {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
         },
         encryptedBuffer
      );

      const credentialsJson = decryptedBuffer.toString("utf8");
      const credentials: ServerCredentials = JSON.parse(credentialsJson);

      return credentials;
   } catch (error) {
      console.error("Decryption failed:", error);
      throw new Error("Failed to decrypt credentials");
   }
}
