import {
   DAY_MS,
   ErrorCode,
   HOUR_MS,
   MINUTE_MS,
   TRANSFERS_PATH,
} from "@s3-viewer/shared";
import express, {
   type Request,
   type RequestHandler,
   type Response,
} from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testServers } from "@/lib/testing/test-server";

const serve = testServers("suite");
let limits: typeof import("./rate-limit");
let origin: string;
let mounted: string;

const asUser: RequestHandler = (req, _res, next) => {
   req.user = { id: req.get("x-user") } as typeof req.user;
   next();
};

const done = (_req: Request, res: Response) => {
   res.status(204).end();
};

const policyAfter =
   (name: string): RequestHandler =>
   (_req, res, next) => {
      res.setHeader(name, String(res.getHeader("RateLimit-Policy") ?? "none"));
      next();
   };

beforeAll(async () => {
   vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
   limits = await import("./rate-limit");
   const app = express();
   app.use(asUser);
   app.post("/invites", limits.inviteLimit, done);
   app.get("/audit", limits.auditSearchLimit, done);
   app.get("/verify", limits.auditVerifyLimit, done);
   app.get("/export", limits.auditBulkLimit, done);
   app.post("/buckets", limits.bucketCreateLimit, done);
   app.post("/servers", limits.serverCreateLimit, done);
   app.get("/zip", limits.archiveDownloadLimit, done);
   app.post("/zip", limits.archiveLimit, done);
   ({ origin } = await serve(app));

   const layered = express();
   layered.use(limits.globalIpLimit, policyAfter("x-global"));
   layered.use(
      [limits.BUCKET_MOUNT, limits.TRANSFER_MOUNT],
      limits.bucketIpLimit,
      policyAfter("x-object")
   );
   layered.use(asUser);
   layered.use(limits.TRANSFER_MOUNT, limits.existsLimit);
   layered.use(limits.connectLimit);
   layered.use(done);
   ({ origin: mounted } = await serve(layered));
});

afterAll(() => {
   vi.useRealTimers();
});

describe("byIp", () => {
   const keyOf = (ip: string | undefined) => limits.byIp({ ip } as Request);

   it("gives every IPv6 address inside one /56 the same key", () => {
      const key = keyOf("2001:db8:aa:bb00::1");
      expect(keyOf("2001:db8:aa:bb00:1234:5678:9abc:def0")).toBe(key);
      expect(keyOf("2001:db8:aa:bbff::2")).toBe(key);
      expect(keyOf("2001:db8:aa:bc00::1")).not.toBe(key);
   });

   it("keeps IPv4 addresses apart and answers a missing address with an empty key", () => {
      expect(keyOf("203.0.113.9")).toBe("203.0.113.9");
      expect(keyOf("::ffff:203.0.113.9")).toBe("203.0.113.9");
      expect(keyOf("203.0.113.10")).not.toBe(keyOf("203.0.113.9"));
      expect(keyOf(undefined)).toBe("");
   });
});

const invite = async (user: string): Promise<number> => {
   const response = await fetch(`${origin}/invites`, {
      method: "POST",
      headers: { "x-user": user },
   });
   await response.arrayBuffer();
   return response.status;
};

const inviteTimes = async (user: string, count: number): Promise<number[]> => {
   const statuses: number[] = [];
   for (let i = 0; i < count; i++) statuses.push(await invite(user));
   return statuses;
};

it("caps one user's invite sends per minute, per hour and per day", async () => {
   expect(await inviteTimes("sender", 5)).not.toContain(429);
   expect(await invite("sender")).toBe(429);

   vi.advanceTimersByTime(MINUTE_MS);
   expect(await inviteTimes("sender", 5)).not.toContain(429);
   vi.advanceTimersByTime(MINUTE_MS);
   expect(await invite("sender")).toBe(429);

   vi.advanceTimersByTime(HOUR_MS);
   expect(await inviteTimes("sender", 5)).not.toContain(429);
   vi.advanceTimersByTime(MINUTE_MS);
   expect(await inviteTimes("sender", 5)).not.toContain(429);
   vi.advanceTimersByTime(HOUR_MS);
   expect(await invite("sender")).toBe(429);

   expect(await invite("someone-else")).toBe(204);
});

const audit = async (query: string): Promise<number> => {
   const response = await fetch(`${origin}/audit${query}`, {
      headers: { "x-user": "auditor" },
   });
   await response.arrayBuffer();
   return response.status;
};

it("caps audit reads whether or not they carry a text search", async () => {
   for (let i = 0; i < 30; i++) expect(await audit("?q=report")).toBe(204);
   for (let i = 0; i < 30; i++) expect(await audit("")).toBe(204);
   expect(await audit("?q=report")).toBe(429);
   expect(await audit("")).toBe(429);
});

const statusOf = async (
   path: string,
   user: string,
   method = "GET"
): Promise<number> => {
   const response = await fetch(`${origin}${path}`, {
      method,
      headers: { "x-user": user },
   });
   await response.arrayBuffer();
   return response.status;
};

it("gives chain verification its own budget, apart from exports", async () => {
   for (let i = 0; i < 10; i++)
      expect(await statusOf("/export", "admin")).toBe(204);
   expect(await statusOf("/export", "admin")).toBe(429);
   for (let i = 0; i < 60; i++)
      expect(await statusOf("/verify", "admin")).toBe(204);
   expect(await statusOf("/verify", "admin")).toBe(429);
   expect(await statusOf("/verify", "someone-else")).toBe(204);
   vi.advanceTimersByTime(10 * MINUTE_MS);
   expect(await statusOf("/verify", "admin")).toBe(204);
   expect(await statusOf("/export", "admin")).toBe(204);
});

it("caps one user's bucket creations per minute and per day", async () => {
   for (let i = 0; i < 20; i++)
      expect(await statusOf("/buckets", "editor", "POST")).toBe(204);
   expect(await statusOf("/buckets", "editor", "POST")).toBe(429);
   expect(await statusOf("/buckets", "owner", "POST")).toBe(204);

   for (let minute = 1; minute < 10; minute++) {
      vi.advanceTimersByTime(MINUTE_MS);
      for (let i = 0; i < 20; i++)
         expect(await statusOf("/buckets", "editor", "POST")).toBe(204);
   }
   vi.advanceTimersByTime(MINUTE_MS);
   expect(await statusOf("/buckets", "editor", "POST")).toBe(429);
   vi.advanceTimersByTime(DAY_MS);
   expect(await statusOf("/buckets", "editor", "POST")).toBe(204);
});

it("caps one user's server creations per day beyond the connect budget", async () => {
   for (let i = 0; i < 30; i++)
      expect(await statusOf("/servers", "churner", "POST")).toBe(204);
   expect(await statusOf("/servers", "churner", "POST")).toBe(429);
   vi.advanceTimersByTime(MINUTE_MS);
   for (let i = 0; i < 20; i++)
      expect(await statusOf("/servers", "churner", "POST")).toBe(204);
   expect(await statusOf("/servers", "churner", "POST")).toBe(429);
   expect(await statusOf("/servers", "owner", "POST")).toBe(204);
   vi.advanceTimersByTime(MINUTE_MS);
   expect(await statusOf("/servers", "churner", "POST")).toBe(429);
   vi.advanceTimersByTime(DAY_MS);
   expect(await statusOf("/servers", "churner", "POST")).toBe(204);
});

it("gives zip redemption its own per-user budget, apart from ticket creation", async () => {
   for (let i = 0; i < 60; i++)
      expect(await statusOf("/zip", "downloader")).toBe(204);
   expect(await statusOf("/zip", "downloader")).toBe(429);
   expect(await statusOf("/zip", "downloader", "POST")).toBe(204);
   expect(await statusOf("/zip", "someone-else")).toBe(204);
   vi.advanceTimersByTime(MINUTE_MS);
   expect(await statusOf("/zip", "downloader")).toBe(204);
});

const layers = async (path: string) => {
   const response = await fetch(`${mounted}${path}`, {
      headers: { "x-user": "browser" },
   });
   await response.arrayBuffer();
   return {
      global: response.headers.get("x-global"),
      object: response.headers.get("x-object"),
   };
};

it("counts bucket and transfer routes against the object allowance, not the global one", async () => {
   const object = { global: "none", object: "6000;w=60" };
   const general = { global: "1200;w=60", object: null };
   expect(await layers("/servers")).toEqual(general);
   expect(await layers("/servers/s1/members")).toEqual(general);
   expect(await layers("/servers/s1/transfersx")).toEqual(general);
   expect(await layers("/servers/s1/buckets")).toEqual(object);
   expect(await layers("/servers/s1/buckets/b/objects")).toEqual(object);
   expect(await layers(`/servers/s1${TRANSFERS_PATH}`)).toEqual(object);
   expect(await layers("/SERVERS/s1/Transfers/")).toEqual(object);
});

const refused = async (path: string) => {
   const response = await fetch(`${mounted}${path}`, {
      method: "POST",
      headers: { "x-user": "mover" },
   });
   const body: unknown = response.status === 429 ? await response.json() : null;
   await response.arrayBuffer().catch(() => undefined);
   return {
      status: response.status,
      policy: response.headers.get("ratelimit-policy"),
      body,
   };
};

it("marks every limiter refusal on the transfer route as not started", async () => {
   const transfers = `/servers/s1${TRANSFERS_PATH}`;
   const notStarted = {
      message: "Too many requests. Please try again later.",
      code: ErrorCode.TRANSFER_NOT_STARTED,
   };
   for (let i = 0; i < 30; i++)
      expect((await refused(transfers)).status).toBe(204);
   expect(await refused(transfers)).toEqual({
      status: 429,
      policy: "30;w=60",
      body: notStarted,
   });
   for (let i = 32; i <= 60; i++)
      expect((await refused(transfers)).status).toBe(429);
   expect(await refused(transfers)).toEqual({
      status: 429,
      policy: "60;w=60",
      body: notStarted,
   });
   expect(await refused("/servers")).toEqual({
      status: 429,
      policy: "30;w=60",
      body: {
         message: "Too many requests. Please try again later.",
         code: ErrorCode.RATE_LIMITED,
      },
   });
});
