/// <reference lib="dom" />

import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
   Provider,
   encryptedCredentialsSchema,
   type CredentialEnvelope,
} from "@s3-viewer/shared";
import { generateKeyPairSync } from "node:crypto";
import { Readable } from "node:stream";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { encryptCredentials } from "../../../web/lib/utils/encryption";
import { getS3ClientFromCredentials } from "@/lib/s3/client-cache";
import { presignedUrl } from "@/lib/s3/presign";
import { decryptCredentials, encryptionPublicKey } from "./encryption";

const state = vi.hoisted(() => ({ privateKey: "" }));
vi.mock("@/lib/env", () => ({
   env: {
      get ENCRYPTION_PRIVATE_KEY() {
         return state.privateKey;
      },
   },
}));
vi.mock("@s3-viewer/db", () => ({ prisma: {} }));

const USER = "user_1234567890";
const OTHER_USER = "user_0987654321";

const credentials = {
   endpoint: "https://s3.amazonaws.com",
   region: "us-east-1",
   accessKey: "permanent-access-key",
   secretKey: "permanent-secret-key",
};

// the v1 wire format sealed nothing to the account; it is refused outright, never read.
const unboundEnvelope = async (): Promise<string> => {
   const sealed = await encryptCredentials(
      credentials,
      encryptionPublicKey(),
      USER
   );
   const envelope = JSON.parse(
      Buffer.from(sealed, "base64").toString("utf8")
   ) as CredentialEnvelope;
   return Buffer.from(JSON.stringify({ ...envelope, v: 1 })).toString("base64");
};

beforeAll(() => {
   state.privateKey = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
   }).privateKey;
});

describe("encrypted credentials through SDK signing", () => {
   it.each([
      {
         endpoint: "https://s3.us-east-1.amazonaws.com",
         region: "us-east-1",
         provider: Provider.S3,
      },
      {
         endpoint: "https://account.r2.cloudflarestorage.com",
         region: "auto",
         provider: Provider.R2,
      },
   ])(
      "preserves temporary tokens for requests and presigned URLs on $provider",
      async ({ provider, ...connection }) => {
         const original = {
            ...connection,
            accessKey: "temporary-access-key",
            secretKey: "temporary-secret-key",
            sessionToken: "temporary-session-token/+with=encoding",
         };
         const encrypted = await encryptCredentials(
            original,
            encryptionPublicKey(),
            USER
         );
         expect(encryptedCredentialsSchema.safeParse(encrypted).success).toBe(
            true
         );
         expect(Buffer.from(encrypted, "base64").toString()).not.toContain(
            original.sessionToken
         );
         const decoded = decryptCredentials(encrypted, USER);
         expect(decoded).toEqual(original);
         const client = getS3ClientFromCredentials(decoded, provider);
         let headers: Record<string, string> = {};
         vi.spyOn(client.config.requestHandler, "handle").mockImplementation(
            async (request) => {
               headers = request.headers;
               return {
                  response: {
                     statusCode: 200,
                     headers: { "content-type": "application/xml" },
                     body: Readable.from([
                        "<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>",
                     ]),
                  },
               };
            }
         );
         await client.send(new ListObjectsV2Command({ Bucket: "bucket" }));
         expect(headers["x-amz-security-token"]).toBe(original.sessionToken);
         expect(headers.authorization).toContain("x-amz-security-token");
         expect(headers.authorization).toContain(
            `/${connection.region}/s3/aws4_request`
         );
         const { url } = await presignedUrl(
            client,
            new GetObjectCommand({ Bucket: "bucket", Key: "file.txt" })
         );
         expect(new URL(url).searchParams.get("X-Amz-Security-Token")).toBe(
            original.sessionToken
         );
      }
   );

   it("keeps long tokens within the encrypted route contract", async () => {
      const original = {
         endpoint: "https://s3.amazonaws.com",
         region: "us-east-1",
         accessKey: "temporary-access-key",
         secretKey: "temporary-secret-key",
         sessionToken: "x".repeat(8192),
      };
      const encrypted = await encryptCredentials(
         original,
         encryptionPublicKey(),
         USER
      );
      expect(encrypted.length).toBeGreaterThan(8192);
      expect(encryptedCredentialsSchema.safeParse(encrypted).success).toBe(
         true
      );
      expect(decryptCredentials(encrypted, USER)).toEqual(original);
      expect(
         encryptedCredentialsSchema.safeParse("x".repeat(65_537)).success
      ).toBe(false);
   });

   it("reads credentials without a session token and signs B2's custom region", async () => {
      const original = {
         endpoint: "https://s3.us-west-004.backblazeb2.com",
         region: "us-west-004",
         accessKey: "permanent-access-key",
         secretKey: "permanent-secret-key",
      };
      const encrypted = await encryptCredentials(
         original,
         encryptionPublicKey(),
         USER
      );
      const decoded = decryptCredentials(encrypted, USER);
      expect(decoded).toEqual(original);
      const client = getS3ClientFromCredentials(decoded, Provider.Other);
      const { url } = await presignedUrl(
         client,
         new GetObjectCommand({ Bucket: "bucket", Key: "file.txt" })
      );
      const query = new URL(url).searchParams;
      expect(query.get("X-Amz-Credential")).toContain(
         "/us-west-004/s3/aws4_request"
      );
      expect(query.has("X-Amz-Security-Token")).toBe(false);
   });
});

describe("account-bound envelopes", () => {
   it("only decrypts for the account it was sealed for", async () => {
      const encrypted = await encryptCredentials(
         credentials,
         encryptionPublicKey(),
         USER
      );
      expect(decryptCredentials(encrypted, USER)).toEqual(credentials);
      expect(() => decryptCredentials(encrypted, OTHER_USER)).toThrow();
   });

   it("refuses an envelope of any other version", async () => {
      const unbound = await unboundEnvelope();
      expect(() => decryptCredentials(unbound, USER)).toThrow();
   });
});
