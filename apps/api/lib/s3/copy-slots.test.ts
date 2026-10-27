import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { withCopySlot } from "./copy-slots";
import { toHttpFailure } from "./errors";
import { withReadUser } from "./read-budget";
import { withRequestBudget } from "./request-budget";

const POOL = Math.floor(env.S3_MAX_INFLIGHT_PER_SERVER / 2);

const serverClient = (serverId: string): S3Client =>
   withRequestBudget(
      new S3Client({
         region: "us-east-1",
         credentials: { accessKeyId: "a", secretAccessKey: "b" },
      }),
      serverId
   );

// holds a slot until released, recording when its copy started.
const holder = (
   client: S3Client,
   started: string[],
   name: string,
   signal?: AbortSignal
) => {
   const done = Promise.withResolvers<void>();
   const settled = withCopySlot(client, signal, async () => {
      started.push(name);
      await done.promise;
      return name;
   });
   return { release: done.resolve, settled };
};

const fill = (client: S3Client, started: string[], count = POOL) =>
   Array.from({ length: count }, (_, index) =>
      holder(client, started, `held-${index}`)
   );

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("copy slots", () => {
   it("admits copies at once below the server's half of the in-flight cap", async () => {
      const started: string[] = [];
      const held = fill(serverClient("below-cap"), started);
      await settle();
      expect(started).toHaveLength(POOL);
      for (const { release } of held) release();
      await Promise.all(held.map(({ settled }) => settled));
   });

   it("queues the next copy and serves waiters in arrival order", async () => {
      const client = serverClient("in-order");
      const started: string[] = [];
      const held = fill(client, started);
      const first = holder(client, started, "first");
      const second = holder(client, started, "second");
      await settle();
      expect(started).not.toContain("first");
      held[0]!.release();
      await settle();
      expect(started.slice(POOL)).toEqual(["first"]);
      held[1]!.release();
      await settle();
      expect(started.slice(POOL)).toEqual(["first", "second"]);
      for (const { release } of [...held, first, second]) release();
      await Promise.all([first.settled, second.settled]);
   });

   it("drops a waiter whose caller gives up, and hands the slot to the next", async () => {
      const client = serverClient("abandoned");
      const started: string[] = [];
      const held = fill(client, started);
      const controller = new AbortController();
      const gone = holder(client, started, "gone", controller.signal);
      const next = holder(client, started, "next");
      const reason = new Error("caller left");
      controller.abort(reason);
      await expect(gone.settled).rejects.toBe(reason);
      held[0]!.release();
      await settle();
      expect(started).not.toContain("gone");
      expect(started).toContain("next");
      for (const { release } of [...held, next]) release();
      await next.settled;
   });

   it("answers a deadline spent queueing as busy storage, not an unreachable one", async () => {
      const client = serverClient("timed-out");
      const started: string[] = [];
      const held = fill(client, started);
      const controller = new AbortController();
      const waiting = holder(client, started, "late", controller.signal);
      controller.abort(
         new DOMException("The operation timed out.", "TimeoutError")
      );
      const error = await waiting.settled.catch((failure: unknown) => failure);
      expect(error).toMatchObject({ kind: "busy" });
      expect(toHttpFailure(error)).toEqual({
         status: 503,
         message: "Storage is busy with other copies. Try again.",
      });
      for (const { release } of held) release();
   });

   it("keeps one user's bulk move to half the pool so a teammate's copy starts", async () => {
      const client = serverClient("per-user");
      const started: string[] = [];
      const userCap = Math.ceil(POOL / 2);
      const bulk = withReadUser("bulk-user", () =>
         Array.from({ length: userCap + 1 }, (_, index) =>
            holder(client, started, `bulk-${index}`)
         )
      );
      await settle();
      expect(started.filter((name) => name.startsWith("bulk"))).toHaveLength(
         userCap
      );
      const teammate = withReadUser("teammate", () =>
         holder(client, started, "teammate")
      );
      await settle();
      expect(started).toContain("teammate");
      expect(started).not.toContain(`bulk-${userCap}`);
      bulk[0]!.release();
      await settle();
      expect(started).toContain(`bulk-${userCap}`);
      for (const { release } of [...bulk, teammate]) release();
      await Promise.all([...bulk, teammate].map(({ settled }) => settled));
   });
});
