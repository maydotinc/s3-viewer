import { HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   AWS_ENDPOINT,
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
const { forCleanup, withoutBudget, withoutRetries } = await import(
   "./no-retry"
);
const { renameObject } = await import("./rename");
const { MAX_RESPONSE_BYTES } = await import("./response-collector");

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

describe("client clones and the per-server budget", () => {
   it("retains the shared HTTP handler and disables region replay", () => {
      const client = budgetedClient();
      client.config.followRegionRedirects = true;
      for (const clone of [
         withoutRetries(client),
         withoutBudget(client),
         forCleanup(client),
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

   it("a no-retry clone spends the same budget as the client it came from", async () => {
      const once = withoutRetries(budgetedClient());
      await expect(once.send(head)).rejects.toThrow("network unavailable");
      await expect(once.send(head)).rejects.toThrow(
         /too many storage requests/
      );
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

   it("an unbudgeted clone is admitted once when the budget is spent", async () => {
      const client = budgetedClient();
      await expect(client.send(head)).rejects.toThrow("network unavailable");
      const clone = withoutBudget(withoutRetries(client));
      expect(await clone.config.maxAttempts()).toBe(1);
      expect(withoutBudget(client)).toBe(clone);
      await expect(clone.send(head)).rejects.toThrow("network unavailable");
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
                  ? reply(
                       200,
                       '<CopyObjectResult><ETag>"copied"</ETag></CopyObjectResult>'
                    )
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
