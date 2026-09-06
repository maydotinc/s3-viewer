import { env } from "@/lib/env";
import type { ServerCredentials } from "@s3-viewer/types";
import {
   constants,
   createDecipheriv,
   createPrivateKey,
   createPublicKey,
   privateDecrypt,
   type KeyObject,
} from "node:crypto";
import { z } from "zod";

const MIN_MODULUS_BITS = 2048;
const GCM_TAG_BYTES = 16;

const base64Schema = z
   .string()
   .min(1)
   .regex(/^[A-Za-z0-9+/]+={0,2}$/);
const envelopeSchema = z.object({
   v: z.literal(1),
   k: base64Schema,
   iv: base64Schema,
   ct: base64Schema,
});

const credentialsSchema = z.object({
   endpoint: z.string().min(1),
   region: z.string().min(1),
   accessKey: z.string().min(1),
   secretKey: z.string().min(1),
   sessionToken: z.string().min(1).optional(),
});

let privateKey: KeyObject | undefined;

const loadPrivateKey = (): KeyObject => {
   if (privateKey) return privateKey;
   try {
      privateKey = createPrivateKey(env.ENCRYPTION_PRIVATE_KEY);
   } catch {
      throw new Error("ENCRYPTION_PRIVATE_KEY is not a valid PEM private key");
   }
   return privateKey;
};

const assertPrivateKey = (): void => {
   const key = loadPrivateKey();
   const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
   if (key.asymmetricKeyType !== "rsa" || bits < MIN_MODULUS_BITS) {
      throw new Error(
         `ENCRYPTION_PRIVATE_KEY must be an RSA key of at least ${MIN_MODULUS_BITS} bits`
      );
   }
};

let publicKeyPem: string | undefined;

// the browser encrypts credentials with this half, and it is derived rather
// than configured so an install only ever has to hold the private key
const encryptionPublicKey = (): string => {
   publicKeyPem ??= createPublicKey(loadPrivateKey())
      .export({ type: "spki", format: "pem" })
      .toString();
   return publicKeyPem;
};

const fromBase64 = (value: string): Buffer => Buffer.from(value, "base64");

const decryptCredentials = (blob: string): ServerCredentials => {
   const envelope = envelopeSchema.parse(
      JSON.parse(fromBase64(blob).toString("utf8"))
   );
   const aesKey = privateDecrypt(
      {
         key: loadPrivateKey(),
         padding: constants.RSA_PKCS1_OAEP_PADDING,
         oaepHash: "sha256",
      },
      fromBase64(envelope.k)
   );
   const sealed = fromBase64(envelope.ct);
   if (sealed.length <= GCM_TAG_BYTES)
      throw new Error("Ciphertext is too short");
   const decipher = createDecipheriv(
      "aes-256-gcm",
      aesKey,
      fromBase64(envelope.iv)
   );
   decipher.setAuthTag(sealed.subarray(sealed.length - GCM_TAG_BYTES));
   const plain = Buffer.concat([
      decipher.update(sealed.subarray(0, sealed.length - GCM_TAG_BYTES)),
      decipher.final(),
   ]);
   return credentialsSchema.parse(JSON.parse(plain.toString("utf8")));
};

export { assertPrivateKey, decryptCredentials, encryptionPublicKey };
