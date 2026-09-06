import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { listBuckets } from "./bucket-listing";
import { canHeadBucket, countBuckets } from "./probe";

const response = (
   name: string,
   token = "",
   headers: Record<string, string> = {}
) => ({
   response: {
      statusCode: 200,
      headers: { "content-type": "application/xml", ...headers },
      body: Readable.from([
         `<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Buckets><Bucket><Name>${name}</Name></Bucket></Buckets>${token}</ListAllMyBucketsResult>`,
      ]),
   },
});

const clientFor = (
   hostname: string,
   handle: (request: {
      query?: Record<string, unknown>;
   }) => Promise<ReturnType<typeof response>>
) =>
   new S3Client({
      region: "us-east-1",
      endpoint: `https://${hostname}`,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      maxAttempts: 1,
      requestHandler: { handle },
   });

describe("bucket listing across providers", () => {
   it.each(["account.r2.cloudflarestorage.com", "s3.us-east-1.amazonaws.com"])(
      "preserves named-bucket setup when %s denies account-wide listing",
      async (hostname) => {
         const client = clientFor(hostname, async () => ({
            response: {
               statusCode: 403,
               headers: { "content-type": "application/xml" },
               body: Readable.from([
                  "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>",
               ]),
            },
         }));
         try {
            expect(await countBuckets(client, "Connect")).toBeNull();
         } finally {
            client.destroy();
         }
      }
   );

   it("rejects invalid keys instead of treating them as bucket-scoped credentials", async () => {
      const client = clientFor(
         "account.r2.cloudflarestorage.com",
         async () => ({
            response: {
               statusCode: 403,
               headers: { "content-type": "application/xml" },
               body: Readable.from([
                  "<Error><Code>InvalidAccessKeyId</Code><Message>Invalid key</Message></Error>",
               ]),
            },
         })
      );
      try {
         await expect(countBuckets(client, "Connect")).rejects.toMatchObject({
            status: 502,
            code: "CREDENTIALS_REJECTED",
         });
      } finally {
         client.destroy();
      }
   });

   it("validates a named R2 bucket after account-wide listing was denied", async () => {
      let calls = 0;
      const client = clientFor("account.r2.cloudflarestorage.com", async () =>
         ++calls === 1
            ? {
                 response: {
                    statusCode: 403,
                    headers: { "content-type": "application/xml" },
                    body: Readable.from([
                       "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>",
                    ]),
                 },
              }
            : response("")
      );
      try {
         expect(await countBuckets(client, "Connect")).toBeNull();
         expect(
            await canHeadBucket(client, "backups", new AbortController().signal)
         ).toBe(true);
         expect(calls).toBe(2);
      } finally {
         client.destroy();
      }
   });

   it("follows R2 response headers instead of treating the echoed XML token as the next page", async () => {
      const requests: unknown[] = [];
      const client = clientFor(
         "account.r2.cloudflarestorage.com",
         async (request) => {
            requests.push(request.query?.["continuation-token"]);
            return requests.length === 1
               ? response(
                    "first",
                    "<IsTruncated>true</IsTruncated><NextContinuationToken>next</NextContinuationToken>",
                    {
                       "cf-is-truncated": "true",
                       "cf-next-continuation-token": "next",
                    }
                 )
               : response(
                    "second",
                    "<ContinuationToken>next</ContinuationToken><IsTruncated>false</IsTruncated>",
                    { "cf-is-truncated": "false" }
                 );
         }
      );
      try {
         const buckets = await listBuckets(
            client,
            new AbortController().signal
         );
         expect(buckets.map(({ Name }) => Name)).toEqual(["first", "second"]);
         expect(requests).toEqual([undefined, "next"]);
      } finally {
         client.destroy();
      }
   });

   it("retains AWS standard token pagination", async () => {
      let calls = 0;
      const client = clientFor("s3.us-east-1.amazonaws.com", async () =>
         ++calls === 1
            ? response("first", "<ContinuationToken>next</ContinuationToken>")
            : response("second")
      );
      try {
         expect(
            (await listBuckets(client, new AbortController().signal)).map(
               ({ Name }) => Name
            )
         ).toEqual(["first", "second"]);
      } finally {
         client.destroy();
      }
   });

   it("supports unpaginated compatible endpoints", async () => {
      const client = clientFor("minio.example.test", async () =>
         response("backups")
      );
      try {
         expect(await countBuckets(client, "Connect")).toBe(1);
      } finally {
         client.destroy();
      }
   });

   it.each(["missing", "repeated"])(
      "rejects an incomplete R2 listing with a %s token",
      async (kind) => {
         const client = clientFor(
            "account.r2.cloudflarestorage.com",
            async () =>
               response("first", "", {
                  "cf-is-truncated": "true",
                  ...(kind === "repeated"
                     ? { "cf-next-continuation-token": "same" }
                     : {}),
               })
         );
         try {
            await expect(
               listBuckets(client, new AbortController().signal)
            ).rejects.toMatchObject({ status: 502 });
         } finally {
            client.destroy();
         }
      }
   );
});
