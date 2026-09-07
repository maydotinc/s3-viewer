import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

const limit = vi.hoisted(() => ({ perMinute: 2 }));

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

const { asyncHandler, errorHandler } = await import("@/lib/http");
const { throwHttpError } = await import("./errors");
const { resetRequestBudgets, spendRequest, withRequestBudget } = await import(
   "./request-budget"
);

// every send fails at the transport: what matters is whether the request was
// admitted at all, not what storage would have answered
const offline = {
   handle: async () => {
      throw new Error("network unavailable");
   },
   updateHttpClientConfig: () => {},
   httpHandlerConfigs: () => ({}),
};

let server: ReturnType<typeof createServer>;
let base: string;

beforeAll(async () => {
   const client = withRequestBudget(
      new S3Client({
         region: "us-east-1",
         credentials: { accessKeyId: "key", secretAccessKey: "secret" },
         maxAttempts: 1,
         requestHandler: offline,
      }),
      "server12345"
   );
   const app = express();
   app.get(
      "/objects",
      asyncHandler(async (_req, res) => {
         try {
            await client.send(
               new HeadObjectCommand({ Bucket: "backups", Key: "report.json" })
            );
         } catch (err) {
            throwHttpError(err);
         }
         res.json({ ok: true });
      })
   );
   app.use(errorHandler);
   server = createServer(app);
   await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
   });
   base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/objects`;
});

afterAll(async () => {
   if (!server) return;
   server.closeAllConnections();
   await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
   limit.perMinute = 2;
   resetRequestBudgets();
   vi.useRealTimers();
});

describe("per-server request budget", () => {
   it("answers 429 through the route once the server's budget is spent", async () => {
      // the transport is down, so an admitted request is an upstream failure
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
});
