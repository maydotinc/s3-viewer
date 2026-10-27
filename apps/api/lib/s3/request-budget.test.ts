import { HeadObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import express from "express";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AWS_ENDPOINT, s3Fixture } from "@/lib/testing/s3-fixture";
import { testServers } from "@/lib/testing/test-server";

const limit = vi.hoisted(() => ({
   perMinute: 2,
   perServer: 32,
   perUser: 64,
   total: 1000,
}));

vi.mock("@/lib/env", async (original) =>
   (await import("@/lib/testing/s3-fixture")).envWithLimits(
      await original<typeof import("@/lib/env")>(),
      {
         S3_REQUESTS_PER_MINUTE: () => limit.perMinute,
         S3_MAX_INFLIGHT_PER_SERVER: () => limit.perServer,
         S3_MAX_INFLIGHT_PER_USER: () => limit.perUser,
         S3_MAX_TOTAL_SOCKETS: () => limit.total,
      }
   )
);

const { asyncHandler, errorHandler } = await import("@/lib/http");
const { storageFailure } = await import("./classify");
const { withReadUser } = await import("./read-budget");
const {
   resetRequestBudgets,
   spendRequest,
   withCancelBudget,
   withRequestBudget,
} = await import("./request-budget");

const budgetedClient = (serverId: string): S3Client =>
   withRequestBudget(
      s3Fixture(
         async () => {
            throw new Error("network unavailable");
         },
         { endpoint: AWS_ENDPOINT }
      ).client,
      serverId
   );

const serve = testServers("suite");
let base: string;

beforeAll(async () => {
   const client = budgetedClient("server12345");
   const app = express();
   app.get(
      "/objects",
      asyncHandler(async (_req, res) => {
         try {
            await client.send(
               new HeadObjectCommand({ Bucket: "backups", Key: "report.json" })
            );
         } catch (err) {
            throw storageFailure(err);
         }
         res.json({ ok: true });
      })
   );
   app.use(errorHandler);
   base = `${(await serve(app)).origin}/objects`;
});

beforeEach(() => {
   limit.perMinute = 2;
   limit.perServer = 32;
   limit.perUser = 64;
   limit.total = 1000;
   resetRequestBudgets();
   vi.useRealTimers();
});

describe("per-server request budget", () => {
   it("answers 429 through the route once the server's budget is spent", async () => {
      expect((await fetch(base)).status).toBe(502);
      expect((await fetch(base)).status).toBe(502);
      const refused = await fetch(base);
      expect(refused.status).toBe(429);
      await expect(refused.json()).resolves.toEqual({
         message:
            "This server has made too many storage requests. Try again in a minute.",
         code: "RATE_LIMITED",
      });
   });

   it("counts each server separately and starts a new window after a minute", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
      limit.perMinute = 1;
      spendRequest("alpha1234");
      expect(() => spendRequest("alpha1234")).toThrowError(
         /too many storage requests/
      );
      expect(() => spendRequest("bravo1234")).not.toThrow();

      vi.setSystemTime(new Date("2026-09-06T12:01:01.000Z"));
      expect(() => spendRequest("alpha1234")).not.toThrow();
   });

   it("lets the only user of a server spend its whole budget", () => {
      limit.perMinute = 8;
      const spend = () =>
         withReadUser("alice", () => spendRequest("alpha1234"));
      for (let spent = 0; spent < 8; spent++) spend();
      expect(spend).toThrowError(
         /^This server has made too many storage requests/
      );
   });

   it("refuses one user at their share and keeps the remainder for other members", () => {
      limit.perMinute = 8;
      const spendAs = (userId: string) =>
         withReadUser(userId, () => spendRequest("alpha1234"));
      spendAs("bob");
      for (let spent = 0; spent < 7; spent++) spendAs("alice");
      for (let refused = 0; refused < 20; refused++) {
         expect(() => spendAs("alice")).toThrowError(
            /^You have made too many storage requests on this server/
         );
      }
      expect(() => spendAs("bob")).toThrowError(
         /^This server has made too many storage requests/
      );
      expect(() =>
         withReadUser("alice", () => spendRequest("bravo1234"))
      ).not.toThrow();
   });

   it("holds a user to their share once a member they locked out has been seen", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
      limit.perMinute = 8;
      const spendAs = (userId: string) =>
         withReadUser(userId, () => spendRequest("alpha1234"));
      for (let spent = 0; spent < 8; spent++) spendAs("alice");
      expect(() => spendAs("bob")).toThrowError(
         /^This server has made too many storage requests/
      );

      vi.setSystemTime(new Date("2026-09-06T12:01:01.000Z"));
      for (let spent = 0; spent < 7; spent++) spendAs("alice");
      expect(() => spendAs("alice")).toThrowError(
         /^You have made too many storage requests/
      );
      expect(() => spendAs("bob")).not.toThrow();

      vi.setSystemTime(new Date("2026-09-06T12:05:00.000Z"));
      for (let spent = 0; spent < 8; spent++) spendAs("alice");
   });

   it("attributes a client's requests to the user whose request sent them", async () => {
      const client = budgetedClient("charlie12");
      const head = () =>
         client.send(
            new HeadObjectCommand({ Bucket: "backups", Key: "report.json" })
         );
      limit.perMinute = 16;
      withReadUser("bob", () => spendRequest("charlie12"));
      for (let sent = 0; sent < 14; sent++) {
         await expect(withReadUser("alice", head)).rejects.toThrow(
            "network unavailable"
         );
      }
      await expect(withReadUser("alice", head)).rejects.toMatchObject({
         kind: "rateLimited",
         message:
            "You have made too many storage requests on this server. Try again in a minute.",
         code: "RATE_LIMITED",
      });
      await expect(head()).rejects.toThrow("network unavailable");
   });
});

describe("in-flight storage request caps", () => {
   const held = (serverId: string, budget = withRequestBudget) => {
      const gate = Promise.withResolvers<void>();
      const client = budget(
         s3Fixture(
            async () => {
               await gate.promise;
               throw new Error("network unavailable");
            },
            { endpoint: AWS_ENDPOINT }
         ).client,
         serverId
      );
      const head = () =>
         client.send(
            new HeadObjectCommand({ Bucket: "backups", Key: "report.json" })
         );
      return { head, open: () => gate.resolve() };
   };
   const quiet = (call: Promise<unknown>) => call.catch(() => undefined);

   beforeEach(() => {
      limit.perMinute = 1000;
   });

   it("refuses a call past the server's cap with the budget's 429 and frees the slot when calls settle", async () => {
      limit.perServer = 2;
      const { head, open } = held("tarpit1234");
      const pending = [quiet(head()), quiet(head())];
      await expect(head()).rejects.toMatchObject({
         kind: "rateLimited",
         message:
            "This server has too many storage requests in progress. Try again shortly.",
         code: "RATE_LIMITED",
      });
      open();
      await Promise.all(pending);
      await expect(head()).rejects.toThrow("network unavailable");
   });

   it("holds the whole process to its total across servers but leaves cancellations their own pool", async () => {
      limit.total = 2;
      const first = held("tarpit1234");
      const second = held("tarpit5678");
      const third = held("tarpit9012");
      const cancel = held("tarpit9012", withCancelBudget);
      const pending = [
         withReadUser("alice", () => quiet(first.head())),
         withReadUser("bob", () => quiet(second.head())),
      ];
      await expect(
         withReadUser("carol", () => third.head())
      ).rejects.toMatchObject({
         kind: "rateLimited",
         message: "Storage is busy. Try again shortly.",
         code: "RATE_LIMITED",
      });
      cancel.open();
      await expect(withReadUser("carol", () => cancel.head())).rejects.toThrow(
         "network unavailable"
      );
      first.open();
      second.open();
      await Promise.all(pending);
      third.open();
      await expect(withReadUser("carol", () => third.head())).rejects.toThrow(
         "network unavailable"
      );
   });

   it("holds one user to their cap across servers without touching other users", async () => {
      limit.perUser = 2;
      const first = held("tarpit1234");
      const second = held("tarpit5678");
      const pending = [
         withReadUser("alice", () => quiet(first.head())),
         withReadUser("alice", () => quiet(second.head())),
      ];
      await expect(
         withReadUser("alice", () => first.head())
      ).rejects.toMatchObject({
         kind: "rateLimited",
         message:
            "You have too many storage requests in progress. Try again shortly.",
      });
      pending.push(withReadUser("bob", () => quiet(first.head())));
      first.open();
      second.open();
      await Promise.all(pending);
      await expect(withReadUser("alice", () => first.head())).rejects.toThrow(
         "network unavailable"
      );
   });

   it("does not charge the minute budget for a refused call", async () => {
      limit.perServer = 1;
      limit.perMinute = 2;
      const { head, open } = held("tarpit1234");
      const pending = quiet(head());
      for (let refused = 0; refused < 5; refused++)
         await expect(head()).rejects.toMatchObject({ kind: "rateLimited" });
      open();
      await pending;
      await expect(head()).rejects.toThrow("network unavailable");
   });

   it("frees the slot when the minute budget refuses the call", async () => {
      limit.perServer = 1;
      limit.perMinute = 1;
      const { head, open } = held("tarpit1234");
      open();
      await expect(head()).rejects.toThrow("network unavailable");
      await expect(head()).rejects.toThrow(/too many storage requests\./);
      await expect(head()).rejects.toThrow(/too many storage requests\./);
   });

   it("holds cancellations to a small pool of their own outside the minute budget", async () => {
      limit.perMinute = 1;
      limit.perServer = 1;
      const first = held("tarpit1234", withCancelBudget);
      const second = held("tarpit5678", withCancelBudget);
      const requests = held("tarpit1234");
      const pending = [quiet(requests.head())];
      for (let index = 0; index < 8; index++)
         pending.push(withReadUser("alice", () => quiet(first.head())));
      await expect(
         withReadUser("alice", () => second.head())
      ).rejects.toMatchObject({
         kind: "rateLimited",
         message:
            "You have too many cancellations in progress. Try again shortly.",
      });
      for (let index = 0; index < 8; index++)
         pending.push(withReadUser("bob", () => quiet(first.head())));
      await expect(
         withReadUser("carol", () => first.head())
      ).rejects.toMatchObject({
         kind: "rateLimited",
         message:
            "This server has too many cancellations in progress. Try again shortly.",
      });
      first.open();
      second.open();
      requests.open();
      await Promise.all(pending);
      await expect(withReadUser("alice", () => second.head())).rejects.toThrow(
         "network unavailable"
      );
   });
});
