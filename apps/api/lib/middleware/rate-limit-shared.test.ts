import express, { type Request, type Response } from "express";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { testServers } from "@/lib/testing/test-server";

const db = vi.hoisted(() => ({
   hits: new Map<string, number>(),
   hit: vi.fn(),
   undo: vi.fn(),
   reset: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { RATE_LIMIT_STORE: "postgres" } }));
vi.mock("@s3-viewer/db/rate-limit", () => ({
   sharedWindowCounter: { hit: db.hit, undo: db.undo, reset: db.reset },
}));

const serve = testServers("suite");
let origin: string;

beforeAll(async () => {
   const { connectLimit, signUpLimit, userLimit } = await import(
      "./rate-limit"
   );
   const app = express();
   app.use((req, _res, next) => {
      req.user = { id: req.get("x-user") } as typeof req.user;
      next();
   });
   const respond = (req: Request, res: Response) => {
      res.status(Number(req.get("x-status") ?? 204)).end();
   };
   app.post("/connect", connectLimit, respond);
   app.post("/sign-up", signUpLimit, respond);
   app.post("/anything", userLimit, respond);
   ({ origin } = await serve(app));
});

beforeEach(() => {
   vi.clearAllMocks();
   db.hits.clear();
   db.hit.mockImplementation(async (key: string, windowMs: number) => {
      const hits = (db.hits.get(key) ?? 0) + 1;
      db.hits.set(key, hits);
      return { hits, resetAt: Date.now() + windowMs };
   });
   db.undo.mockImplementation(async (key: string) => {
      db.hits.set(key, Math.max((db.hits.get(key) ?? 0) - 1, 0));
   });
});

const post = async (
   path: string,
   user: string,
   status = 204
): Promise<number> => {
   const response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "x-user": user, "x-status": String(status) },
   });
   await response.arrayBuffer();
   return response.status;
};

it("stops writing to the shared store once this replica knows a key is over its limit", async () => {
   for (let i = 0; i < 30; i++)
      expect(await post("/connect", "flood")).toBe(204);
   expect(db.hit).toHaveBeenCalledTimes(30);
   expect(db.hit).toHaveBeenLastCalledWith("connect:flood", 60_000);

   for (let i = 0; i < 25; i++)
      expect(await post("/connect", "flood")).toBe(429);
   expect(db.hit).toHaveBeenCalledTimes(31);

   expect(await post("/connect", "bystander")).toBe(204);
   expect(db.hit).toHaveBeenCalledTimes(32);
});

it("answers a remembered refusal with the headers the first one carried", async () => {
   db.hits.set("connect:repeat", 30);
   const headersOf = async () => {
      const response = await fetch(`${origin}/connect`, {
         method: "POST",
         headers: { "x-user": "repeat" },
      });
      await response.arrayBuffer();
      expect(response.status).toBe(429);
      return ["ratelimit-policy", "ratelimit", "retry-after"].map((name) =>
         response.headers.get(name)
      );
   };
   vi.useFakeTimers({ toFake: ["Date"] });
   try {
      const first = await headersOf();
      const remembered = await headersOf();
      expect(db.hit).toHaveBeenCalledOnce();
      expect(first).toEqual([
         "30;w=60",
         "limit=30, remaining=0, reset=60",
         "60",
      ]);
      expect(remembered).toEqual(first);
   } finally {
      vi.useRealTimers();
   }
});

it("asks the shared store again once the window it refused in has ended", async () => {
   vi.useFakeTimers({ toFake: ["Date"] });
   try {
      db.hits.set("connect:waiter", 30);
      expect(await post("/connect", "waiter")).toBe(429);
      expect(await post("/connect", "waiter")).toBe(429);
      expect(db.hit).toHaveBeenCalledOnce();

      vi.advanceTimersByTime(60_001);
      db.hits.clear();
      expect(await post("/connect", "waiter")).toBe(204);
      expect(db.hit).toHaveBeenCalledTimes(2);
   } finally {
      vi.useRealTimers();
   }
});

it("keeps failed requests out of both counters when only successes are budgeted", async () => {
   for (let i = 0; i < 15; i++)
      expect(await post("/sign-up", "", 422)).toBe(422);
   await vi.waitFor(() => expect(db.undo).toHaveBeenCalledTimes(15));
   expect(db.hit).toHaveBeenCalledTimes(15);

   for (let i = 0; i < 10; i++) expect(await post("/sign-up", "")).toBe(204);
   expect(await post("/sign-up", "")).toBe(429);
   expect(await post("/sign-up", "")).toBe(429);
   expect(db.hit).toHaveBeenCalledTimes(26);
   await vi.waitFor(() => expect(db.undo).toHaveBeenCalledTimes(16));
});

it("never touches the shared store for a limit that is not shared", async () => {
   expect(await post("/anything", "member")).toBe(204);
   expect(db.hit).not.toHaveBeenCalled();
});

it("fails a request instead of allowing it when the shared store is down", async () => {
   db.hit.mockRejectedValue(new Error("down"));
   expect(await post("/connect", "outage")).toBe(500);
});
