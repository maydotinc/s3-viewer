import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MINUTE_MS } from "@s3-viewer/types";

const db = vi.hoisted(() => ({
   hit: vi.fn(),
   undo: vi.fn(),
   store: "memory" as "memory" | "postgres",
}));

vi.mock("@s3-viewer/db/rate-limit", () => ({
   hitRateLimit: db.hit,
   undoRateLimitHit: db.undo,
}));

vi.mock("@/lib/env", () => ({
   env: {
      get RATE_LIMIT_STORE() {
         return db.store;
      },
   },
}));

const { inviteEmailBudget, memoryCounter, reserveInviteEmail } = await import(
   "./invite-email-budget"
);

const SERVER = "server12345";

let reserve: ReturnType<typeof inviteEmailBudget>;

beforeEach(() => {
   vi.useFakeTimers({ toFake: ["Date"] });
   vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
   vi.spyOn(console, "log").mockImplementation(() => {});
   vi.spyOn(console, "error").mockImplementation(() => {});
   const counter = memoryCounter();
   reserve = inviteEmailBudget(() => counter);
   db.store = "memory";
   db.hit.mockReset();
   db.undo.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
   vi.useRealTimers();
   vi.restoreAllMocks();
});

const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe("invite email budget", () => {
   it("emails the same address on one server again only after the cooldown", async () => {
      expect(await reserve(SERVER, "one@example.com")).not.toBeNull();
      later(14 * MINUTE_MS);
      expect(await reserve(SERVER, "one@example.com")).toBeNull();
      later(MINUTE_MS);
      expect(await reserve(SERVER, "one@example.com")).not.toBeNull();
   });

   it("does not spend the recipient's daily budget on a send the cooldown refused", async () => {
      await reserve(SERVER, "one@example.com");
      for (let i = 0; i < 5; i++) await reserve(SERVER, "one@example.com");
      expect(await reserve("server2abcdef", "one@example.com")).not.toBeNull();
      expect(await reserve("server3abcdef", "one@example.com")).not.toBeNull();
      expect(await reserve("server4abcdef", "one@example.com")).toBeNull();
   });

   it("gives the budget back when a send fails", async () => {
      const first = await reserve(SERVER, "one@example.com");
      await first!.release();
      expect(await reserve(SERVER, "one@example.com")).not.toBeNull();
   });

   it("resets the recipient budget a day later", async () => {
      for (const server of ["serverAabcdef", "serverBabcdef", "serverCabcdef"])
         await reserve(server, "victim+x@gmail.com");
      expect(await reserve("serverDabcdef", "vic.tim@gmail.com")).toBeNull();
      later(24 * 60 * MINUTE_MS);
      expect(
         await reserve("serverDabcdef", "vic.tim@gmail.com")
      ).not.toBeNull();
   });
});

describe("the shared store", () => {
   beforeEach(() => {
      db.store = "postgres";
   });

   it("keys counters by a hash of the canonical mailbox, never the address", async () => {
      db.hit.mockResolvedValue({ hits: 1, resetAt: new Date() });
      expect(await reserveInviteEmail(SERVER, "Victim+a@Gmail.com")).not.toBe(
         null
      );
      const keys = db.hit.mock.calls.map(([key]) => String(key));
      expect(keys).toHaveLength(3);
      expect(keys.join(" ")).not.toMatch(/victim|gmail/i);
      await reserveInviteEmail("server2abcdef", "victim+b@gmail.com");
      const recipientKeys = db.hit.mock.calls
         .map(([key]) => String(key))
         .filter((key) => key.startsWith("invite-mail:to:"));
      expect(new Set(recipientKeys).size).toBe(1);
   });

   it("undoes the hits it took when a later budget is spent", async () => {
      db.hit
         .mockResolvedValueOnce({ hits: 1, resetAt: new Date() })
         .mockResolvedValueOnce({ hits: 4, resetAt: new Date() });
      expect(await reserveInviteEmail(SERVER, "one@example.com")).toBeNull();
      expect(db.hit).toHaveBeenCalledTimes(2);
      expect(db.undo.mock.calls.map(([key]) => key)).toEqual(
         db.hit.mock.calls.map(([key]) => key)
      );
   });

   it("sends nothing when the store is unavailable", async () => {
      db.hit.mockRejectedValue(new Error("pool timeout"));
      expect(await reserveInviteEmail(SERVER, "one@example.com")).toBeNull();
      expect(
         vi
            .mocked(console.error)
            .mock.calls.some(([line]) =>
               String(line).includes("Invite email budget unavailable")
            )
      ).toBe(true);
   });
});
