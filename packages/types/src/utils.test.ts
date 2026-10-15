import { describe, expect, it } from "vitest";
import {
   backblazeRegion,
   chunkKeys,
   describeError,
   formatEmailDomains,
   joinList,
   mapLimit,
} from "./utils";

const tick = () => new Promise<void>((r) => setTimeout(r, 1));

describe("joinList", () => {
   it("joins with commas and a final and, leaving short lists alone", () => {
      expect(joinList([])).toBe("");
      expect(joinList(["a"])).toBe("a");
      expect(joinList(["a", "b"])).toBe("a and b");
      expect(joinList(["a", "b", "c", "d"])).toBe("a, b, c and d");
   });
});

describe("formatEmailDomains", () => {
   it("prefixes each domain and joins them as a list", () => {
      expect(formatEmailDomains([])).toBe("");
      expect(formatEmailDomains(["acme.com"])).toBe("@acme.com");
      expect(formatEmailDomains(["acme.com", "acme.dev", "acme.io"])).toBe(
         "@acme.com, @acme.dev and @acme.io"
      );
   });
});

describe("backblazeRegion", () => {
   it.each([
      ["https://s3.us-west-004.backblazeb2.com", "us-west-004"],
      ["https://bucket.s3.eu-central-003.backblazeb2.com", "eu-central-003"],
      ["https://S3.US-EAST-005.BACKBLAZEB2.COM", "us-east-005"],
      ["https://s3.us-west-004.backblazeb2.com.", "us-west-004"],
      ["https://s3.us-west-004.backblazeb2.com.example.org", undefined],
      ["https://s3.us-west-004.backblazeb2.com@example.org", undefined],
      ["https://example.org/s3.us-west-004.backblazeb2.com", undefined],
      ["http://s3.us-west-004.backblazeb2.com", undefined],
      ["https://s3.amazonaws.com", undefined],
      ["invalid", undefined],
   ])("recognizes only B2 HTTPS hosts: %s", (endpoint, expected) => {
      expect(backblazeRegion(endpoint)).toBe(expected);
   });
});

describe("chunkKeys", () => {
   it("splits by key count and by total characters, never leaving a batch empty", () => {
      expect(chunkKeys(["aaaa", "bbbb", "cccc"], 2, 100)).toEqual([
         ["aaaa", "bbbb"],
         ["cccc"],
      ]);
      expect(chunkKeys(["aaaa", "bbbb", "cccc"], 10, 8)).toEqual([
         ["aaaa", "bbbb"],
         ["cccc"],
      ]);
      expect(chunkKeys(["a".repeat(20), "b"], 10, 8)).toEqual([
         ["a".repeat(20)],
         ["b"],
      ]);
      expect(chunkKeys([], 10, 8)).toEqual([]);
   });
});

describe("mapLimit", () => {
   it("preserves order and never exceeds the concurrency limit", async () => {
      let inFlight = 0;
      let peak = 0;
      const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
         inFlight++;
         peak = Math.max(peak, inFlight);
         await tick();
         inFlight--;
         return n * 2;
      });
      expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
      expect(peak).toBe(3);
   });

   it("handles empty input", async () => {
      expect(await mapLimit([], 5, async (x: number) => x)).toEqual([]);
   });

   it("stops handing out items once the signal fires and leaves the rest undefined", async () => {
      const controller = new AbortController();
      const started: number[] = [];
      const out = await mapLimit(
         [1, 2, 3, 4, 5, 6],
         2,
         async (n) => {
            started.push(n);
            if (n === 2) controller.abort();
            await tick();
            return n;
         },
         { signal: controller.signal }
      );
      expect(started).toEqual([1, 2]);
      expect(out).toEqual([1, 2, undefined, undefined, undefined, undefined]);
   });

   it("types the result as possibly incomplete for an optional signal", async () => {
      const scope: { signal?: AbortSignal } = {};
      const out = await mapLimit([1, 2], 2, async (n) => n, {
         signal: scope.signal,
      });
      // @ts-expect-error a signal may leave holes, so this is not number[]
      const complete: number[] = out;
      expect(complete).toEqual([1, 2]);
   });

   it("with settle, waits for the items in flight before rejecting with the first failure", async () => {
      const events: string[] = [];
      await expect(
         mapLimit(
            [1, 2, 3, 4],
            2,
            async (n) => {
               if (n === 1) {
                  events.push("1 failed");
                  throw new Error("first");
               }
               if (n === 2) {
                  await tick();
                  await tick();
                  events.push("2 settled");
                  throw new Error("second");
               }
               events.push(`${n} started`);
               return n;
            },
            { settle: true }
         )
      ).rejects.toThrow("first");
      expect(events).toEqual(["1 failed", "2 settled"]);
   });

   it("rejects when a worker rejects and stops scheduling more", async () => {
      const started: number[] = [];
      await expect(
         mapLimit([1, 2, 3, 4], 1, async (n) => {
            started.push(n);
            if (n === 2) throw new Error("boom");
            return n;
         })
      ).rejects.toThrow("boom");
      expect(started).toEqual([1, 2]);
   });
});

describe("describeError", () => {
   const prismaError = (name: string, message: string, extra: object = {}) =>
      Object.assign(new Error(message), { name, ...extra });

   it("names a plain error by class and message", () => {
      expect(describeError(new TypeError("boom"))).toBe("TypeError: boom");
      expect(describeError("plain")).toBe("plain");
   });

   it("keeps a prisma request error to its class, code and target", () => {
      const error = prismaError(
         "PrismaClientKnownRequestError",
         'data: { email: "ada@example.com" }',
         { code: "P2002", meta: { target: ["serverId", "email"] } }
      );
      expect(describeError(error)).toBe(
         "PrismaClientKnownRequestError P2002 (target: serverId, email)"
      );
      expect(
         describeError(
            prismaError("PrismaClientKnownRequestError", "x", {
               code: "P2010",
               meta: { code: "23505", message: "Key (email)=(ada@x.co)" },
            })
         )
      ).toBe("PrismaClientKnownRequestError P2010");
   });

   it("keeps an initialization error to its error code and an unknown one to its class", () => {
      expect(
         describeError(
            prismaError("PrismaClientInitializationError", "at db.host", {
               errorCode: "P1001",
            })
         )
      ).toBe("PrismaClientInitializationError P1001");
      expect(
         describeError(
            prismaError("PrismaClientUnknownRequestError", "Key (id)=(1)")
         )
      ).toBe("PrismaClientUnknownRequestError");
   });

   it("keeps only the first line of a validation error", () => {
      const error = prismaError(
         "PrismaClientValidationError",
         '\nInvalid `prisma.user.create()` invocation:\n\n  email: "ada@example.com"'
      );
      expect(describeError(error)).toBe(
         "PrismaClientValidationError: Invalid `prisma.user.create()` invocation:"
      );
   });
});
