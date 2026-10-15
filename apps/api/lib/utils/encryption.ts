import { env } from "@/lib/env";
import { BASE64_PATTERN } from "./audit-chain-key";
import {
   CREDENTIAL_ENVELOPE_VERSION,
   serverCredentialsSchema,
   type ServerCredentials,
} from "@s3-viewer/types";
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

const base64Schema = z.string().min(1).regex(BASE64_PATTERN);
const envelopeSchema = z.object({
   v: z.literal(CREDENTIAL_ENVELOPE_VERSION),
   k: base64Schema,
   iv: base64Schema,
   ct: base64Schema,
});
type Envelope = z.infer<typeof envelopeSchema>;

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

let publicKey: KeyObject | undefined;
let publicKeyPem: string | undefined;

const loadPublicKey = (): KeyObject => {
   publicKey ??= createPublicKey(loadPrivateKey());
   return publicKey;
};

const encryptionPublicKey = (): string => {
   publicKeyPem ??= loadPublicKey()
      .export({ type: "spki", format: "pem" })
      .toString();
   return publicKeyPem;
};

const fromBase64 = (value: string): Buffer => Buffer.from(value, "base64");

const parseEnvelope = (blob: string): Envelope =>
   envelopeSchema.parse(JSON.parse(fromBase64(blob).toString("utf8")));

const oaep = (key: KeyObject) => ({
   key,
   padding: constants.RSA_PKCS1_OAEP_PADDING,
   oaepHash: "sha256",
});

const decryptCredentials = (
   blob: string,
   boundTo: string
): ServerCredentials => {
   const envelope = parseEnvelope(blob);
   const aesKey = privateDecrypt(
      oaep(loadPrivateKey()),
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
   decipher.setAAD(Buffer.from(boundTo, "utf8"));
   decipher.setAuthTag(sealed.subarray(sealed.length - GCM_TAG_BYTES));
   const plain = Buffer.concat([
      decipher.update(sealed.subarray(0, sealed.length - GCM_TAG_BYTES)),
      decipher.final(),
   ]);
   return serverCredentialsSchema.parse(JSON.parse(plain.toString("utf8")));
};

export { assertPrivateKey, decryptCredentials, encryptionPublicKey };
