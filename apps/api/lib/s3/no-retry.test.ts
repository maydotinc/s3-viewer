import {
   DeleteObjectCommand,
   HeadObjectCommand,
   ListObjectsV2Command,
   PutObjectCommand,
   type S3Client,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   AWS_ENDPOINT,
   copiedXml,
   empty,
   reply,
   s3Fixture,
} from "@/lib/testing/s3-fixture";

const limit = vi.hoisted(() => ({ perMinute: 1 }));

vi.mock("@/lib/env", async (original) => {
   const actual = await original<typeof import("@/lib/env")>();
   return {
      ...actual,
      env: {
         ...actual.env,
         get S3_REQUESTS_PER_MINUTE() {
            return limit.perMinute;
         },
      },
   };
});

const { resetRequestBudgets, withRequestBudget } = await import(
   "./request-budget"
);
const { forCancel, forCleanup, withoutBudget, withoutRetries } = await import(
   "./no-retry"
);
const { renameObject } = await import("./rename");
const { MAX_RESPONSE_BYTES } = await import("./response-collector");
const { installReadBudget } = await import("./read-budget.fixture");

const head = new HeadObjectCommand({ Bucket: "backups", Key: "report.json" });

const budgetedClient = () =>
   withRequestBudget(
      s3Fixture(
         async () => {
            throw new Error("network unavailable");
         },
         { maxAttempts: 1 }
      ).client,
      "server12345"
   );

beforeEach(() => {
   limit.perMinute = 1;
   resetRequestBudgets();
});

afterEach(() => vi.restoreAllMocks());

describe("client clones and the per-server budget", () => {
   it("retains the shared HTTP handler and disables region replay", () => {
      const client = budgetedClient();
      client.config.followRegionRedirects = true;
      for (const clone of [
         withoutRetries(client),
         withoutBudget(client),
         forCleanup(client),
         forCancel(client),
      ]) {
         expect(clone.config.requestHandler).toBe(client.config.requestHandler);
         expect(clone.config.followRegionRedirects).toBe(false);
      }
   });

   it("keeps buffered-response protection on a cleanup clone after quota exhaustion", async () => {
      const client = withRequestBudget(
         s3Fixture(
            async (request) =>
               request.method === "HEAD"
                  ? empty()
                  : reply(200, " ".repeat(MAX_RESPONSE_BYTES + 1)),
            { maxAttempts: 1 }
         ).client,
         "cleanup-response"
      );
      try {
         await client.send(head);
         await expect(
            forCleanup(client).send(
               new ListObjectsV2Command({ Bucket: "backups" })
            )
         ).rejects.toMatchObject({ name: "ResponseTooLarge" });
      } finally {
         client.destroy();
      }
   });

   it("the clone and its source share one window", async () => {
      const client = budgetedClient();
      await expect(client.send(head)).rejects.toThrow("network unavailable");
      await expect(withoutRetries(client).send(head)).rejects.toThrow(
         /too many storage requests/
      );
   });

   it("gives the cleanup clone its own attempts whatever it was derived from", async () => {
      const client = budgetedClient();
      expect(await withoutRetries(client).config.maxAttempts()).toBe(1);
      expect(
         await forCleanup(withoutRetries(client)).config.maxAttempts()
      ).toBe(3);
   });

   it("a cleanup clone is admitted even when the budget is spent", async () => {
      const client = budgetedClient();
      await expect(client.send(head)).rejects.toThrow("network unavailable");
      await expect(forCleanup(client).send(head)).rejects.toThrow(
         "network unavailable"
      );
   });

   it("a cancel clone retries like cleanup and is admitted when the budget is spent", async () => {
      const client = budgetedClient();
      await expect(client.send(head)).rejects.toThrow("network unavailable");
      const cancel = forCancel(withoutRetries(client));
      expect(await cancel.config.maxAttempts()).toBe(3);
      expect(forCancel(client)).toBe(cancel);
      expect(cancel).not.toBe(forCleanup(client));
      expect(
         cancel.middlewareStack
            .identify()
            .some((entry) => entry.startsWith("cancelBudget"))
      ).toBe(true);
      await expect(cancel.send(head)).rejects.toThrow("network unavailable");
   });

   it("an unbudgeted clone is admitted once when the budget is spent", async () => {
      const client = budgetedClient();
      await expect(client.send(head)).rejects.toThrow("network unavailable");
      const clone = withoutBudget(withoutRetries(client));
      expect(await clone.config.maxAttempts()).toBe(1);
      expect(withoutBudget(client)).toBe(clone);
      await expect(clone.send(head)).rejects.toThrow("network unavailable");
   });

   it.each([
      [
         "refuses a budgeted write before sending it",
         (client: S3Client) =>
            client.send(
               new PutObjectCommand({ Bucket: "backups", Key: "report.json" })
            ),
         0,
      ],
      [
         "sends an unbudgeted clone's committed tail",
         (client: S3Client) =>
            withoutBudget(client).send(
               new DeleteObjectCommand({
                  Bucket: "backups",
                  Key: "report.json",
               })
            ),
         1,
      ],
   ])("with the read pool full, %s", async (_name, send, sent) => {
      const fixture = s3Fixture(async () => empty(204), { maxAttempts: 1 });
      const client = withRequestBudget(fixture.client, "full-reads");
      const held = installReadBudget(1_000_000, {
         total: 1,
         user: 1,
         server: 1,
      }).acquire({ serverId: "other" });
      try {
         if (sent) await send(client);
         else
            await expect(send(client)).rejects.toThrow(
               /response capacity is busy/
            );
         expect(fixture.requests).toHaveLength(sent);
      } finally {
         held.release();
         client.destroy();
      }
   });

   it("removes the source of a rename whose copy used the last of the budget", async () => {
      const seen: string[] = [];
      let present = true;
      const client = withRequestBudget(
         s3Fixture(
            async (request) => {
               seen.push(request.method);
               if (request.method === "DELETE") present = false;
               if ("acl" in request.query) return empty(403);
               if (request.method === "DELETE") return empty(204);
               return request.method === "PUT"
                  ? reply(200, copiedXml('"copied"'))
                  : empty();
            },
            { endpoint: AWS_ENDPOINT, maxAttempts: 1 }
         ).client,
         "rename-budget"
      );
      limit.perMinute = 2;
      try {
         await renameObject({ client, bucket: "backups" }, Provider.S3, {
            objectKey: "report.json",
            newObjectKey: "renamed.json",
            source: { ContentLength: 4, $metadata: {} },
            sourceETag: '"reviewed"',
         });
         expect(seen).toEqual(["GET", "PUT", "DELETE"]);
         expect(present).toBe(false);
         await expect(client.send(head)).rejects.toThrow(
            /too many storage requests/
         );
      } finally {
         client.destroy();
      }
   });
});
