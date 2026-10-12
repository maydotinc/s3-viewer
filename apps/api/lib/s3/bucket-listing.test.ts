import { describe, expect, it } from "vitest";
import { reply, s3Fixture, type FixtureReply } from "@/lib/testing/s3-fixture";
import { listBuckets } from "./bucket-listing";
import { assertCredentialsWork, canHeadBucket, countBuckets } from "./probe";

const bucketsPage = (
   name: string,
   token = "",
   headers: Record<string, string> = {}
): FixtureReply =>
   reply(
      200,
      `<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Buckets><Bucket><Name>${name}</Name></Bucket></Buckets>${token}</ListAllMyBucketsResult>`,
      { "content-type": "application/xml", ...headers }
   );

const refused = (code: string, message: string): FixtureReply =>
   reply(
      403,
      `<Error><Code>${code}</Code><Message>${message}</Message></Error>`,
      {
         "content-type": "application/xml",
      }
   );

const clientFor = (
   hostname: string,
   handle: (request: {
      query?: Record<string, unknown>;
   }) => Promise<FixtureReply>
) =>
   s3Fixture(handle, {
      endpoint: `https://${hostname}`,
      forcePathStyle: false,
      maxAttempts: 1,
   }).client;

describe("bucket listing across providers", () => {
   it.each([
      "account.r2.cloudflarestorage.com",
      "s3.us-east-1.amazonaws.com",
      "minio.example.test",
   ])(
      "validates list permission on %s with only the first page",
      async (hostname) => {
         let calls = 0;
         const client = clientFor(hostname, async () => {
            calls++;
            return bucketsPage(
               "first",
               "<ContinuationToken>next</ContinuationToken>",
               {
                  "cf-is-truncated": "true",
                  "cf-next-continuation-token": "next",
               }
            );
         });
         try {
            await expect(
               assertCredentialsWork(client, [], "Rotate credentials")
            ).resolves.toBeUndefined();
            expect(calls).toBe(1);
         } finally {
            client.destroy();
         }
      }
   );

   it.each(["account.r2.cloudflarestorage.com", "s3.us-east-1.amazonaws.com"])(
      "preserves named-bucket setup when %s denies account-wide listing",
      async (hostname) => {
         const client = clientFor(hostname, async () =>
            refused("AccessDenied", "Access Denied")
         );
         try {
            expect(await countBuckets(client, "Connect")).toBeNull();
            await expect(
               assertCredentialsWork(client, [], "Rotate credentials")
            ).rejects.toMatchObject({
               status: 403,
               message: "These credentials can't list buckets",
            });
         } finally {
            client.destroy();
         }
      }
   );

   it("rejects invalid keys instead of treating them as bucket-scoped credentials", async () => {
      const client = clientFor("account.r2.cloudflarestorage.com", async () =>
         refused("InvalidAccessKeyId", "Invalid key")
      );
      try {
         await expect(countBuckets(client, "Connect")).rejects.toMatchObject({
            status: 502,
            code: "CREDENTIALS_REJECTED",
         });
         await expect(
            assertCredentialsWork(client, [], "Rotate credentials")
         ).rejects.toMatchObject({
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
            ? refused("AccessDenied", "Access Denied")
            : bucketsPage("")
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
               ? bucketsPage(
                    "first",
                    "<IsTruncated>true</IsTruncated><NextContinuationToken>next</NextContinuationToken>",
                    {
                       "cf-is-truncated": "true",
                       "cf-next-continuation-token": "next",
                    }
                 )
               : bucketsPage(
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
      const requests: unknown[] = [];
      const client = clientFor(
         "s3.us-east-1.amazonaws.com",
         async (request) => {
            requests.push(request.query?.["max-buckets"]);
            return ++calls === 1
               ? bucketsPage(
                    "first",
                    "<ContinuationToken>next</ContinuationToken>"
                 )
               : bucketsPage("second");
         }
      );
      try {
         expect(
            (await listBuckets(client, new AbortController().signal)).map(
               ({ Name }) => Name
            )
         ).toEqual(["first", "second"]);
         expect(requests).toEqual(["1000", "1000"]);
      } finally {
         client.destroy();
      }
   });

   it("supports unpaginated compatible endpoints", async () => {
      const client = clientFor("minio.example.test", async () =>
         bucketsPage("backups")
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
               bucketsPage("first", "", {
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
