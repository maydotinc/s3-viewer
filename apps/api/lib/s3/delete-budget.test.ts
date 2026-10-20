import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   AWS_ENDPOINT,
   MINIO_ENDPOINT,
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
const { readBudget } = await import("./read-budget");
const { deleteKeys } = await import("./delete");

const BUDGET_MESSAGE = /too many storage requests/;
const SERVER = "delete-budget";
const CONTROL_KEY = "line\nbreak";

const deletedAll = (body: unknown) =>
   reply(
      200,
      "<DeleteResult>" +
         [...String(body).matchAll(/<Key>([^<]*)<\/Key>/g)]
            .map((match) => `<Deleted><Key>${match[1]}</Key></Deleted>`)
            .join("") +
         "</DeleteResult>",
      { "content-type": "application/xml" }
   );

const fixture = (endpoint: string) => {
   const { client, requests } = s3Fixture(
      async (request) =>
         request.method === "HEAD"
            ? empty(200, { etag: '"reviewed"' })
            : deletedAll(request.body),
      { endpoint }
   );
   return { client: withRequestBudget(client, SERVER), requests };
};

beforeEach(() => {
   resetRequestBudgets();
});

describe("deletes refused by the storage request budget", () => {
   it("does not call an unsent batch delete unconfirmed", async () => {
      limit.perMinute = 2;
      const { client, requests } = fixture(MINIO_ENDPOINT);
      try {
         const result = await deleteKeys({ client, bucket: "bucket" }, [
            { key: "a", expectedETag: '"reviewed"' },
            { key: "b", expectedETag: '"reviewed"' },
         ]);
         expect(result).toEqual({
            alreadyGone: [],
            deleted: [],
            failed: ["a", "b"].map((key) => ({
               key,
               message: expect.stringMatching(BUDGET_MESSAGE),
               retryable: true,
               refused: true,
            })),
         });
         expect(requests.map(({ method }) => method)).toEqual(["HEAD", "HEAD"]);
      } finally {
         client.destroy();
      }
   });

   it("does not call an unsent single-key delete unconfirmed", async () => {
      limit.perMinute = 1;
      const { client, requests } = fixture(MINIO_ENDPOINT);
      try {
         const result = await deleteKeys({ client, bucket: "bucket" }, [
            { key: CONTROL_KEY, expectedETag: '"reviewed"' },
         ]);
         expect(result).toEqual({
            alreadyGone: [],
            deleted: [],
            failed: [
               {
                  key: CONTROL_KEY,
                  message: expect.stringMatching(BUDGET_MESSAGE),
                  retryable: true,
                  refused: true,
               },
            ],
         });
         expect(requests.map(({ method }) => method)).toEqual(["HEAD"]);
      } finally {
         client.destroy();
      }
   });

   it("marks refused ETag lookups and conditional batches retryable on AWS", async () => {
      limit.perMinute = 1;
      const { client, requests } = fixture(AWS_ENDPOINT);
      try {
         const result = await deleteKeys({ client, bucket: "bucket" }, [
            { key: "a", expectedETag: null },
            { key: "b", expectedETag: null },
         ]);
         expect(result).toEqual({
            alreadyGone: [],
            deleted: [],
            failed: ["b", "a"].map((key) => ({
               key,
               message: expect.stringMatching(BUDGET_MESSAGE),
               retryable: true,
               refused: true,
            })),
         });
         expect(requests.map(({ method }) => method)).toEqual(["HEAD"]);
      } finally {
         client.destroy();
      }
   });

   const fillReadBudget = () =>
      Array.from({ length: 64 }, () =>
         readBudget.acquire({ serverId: SERVER, userId: crypto.randomUUID() })
      );

   it("refuses a delete before sending it when no response could be read", async () => {
      limit.perMinute = 100;
      const { client, requests } = fixture(AWS_ENDPOINT);
      const held = fillReadBudget();
      try {
         const result = await deleteKeys({ client, bucket: "bucket" }, [
            { key: "a", expectedETag: '"reviewed"' },
         ]);
         expect(requests).toEqual([]);
         expect(result.deleted).toEqual([]);
         expect(result.failed).toEqual([
            expect.objectContaining({ key: "a", retryable: true }),
         ]);
      } finally {
         for (const reservation of held) reservation.release();
         client.destroy();
      }
   });

   it("reads the answer to a sent delete even when the budget filled meanwhile", async () => {
      limit.perMinute = 100;
      const held: ReturnType<typeof fillReadBudget> = [];
      const { client: raw } = s3Fixture(
         async (request) => {
            held.push(...fillReadBudget());
            return deletedAll(request.body);
         },
         { endpoint: AWS_ENDPOINT }
      );
      const client = withRequestBudget(raw, SERVER);
      try {
         const result = await deleteKeys({ client, bucket: "bucket" }, [
            { key: "a", expectedETag: '"reviewed"' },
         ]);
         expect(result).toEqual({
            alreadyGone: [],
            deleted: ["a"],
            failed: [],
         });
      } finally {
         for (const reservation of held) reservation.release();
         client.destroy();
      }
   });
});
