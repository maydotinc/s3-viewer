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

const { inviteEmailBudget, memoryCounter, reserveInviteEmails } = await import(
   "./invite-email-budget"
);

const SERVER = "server12345";
const OTHER = "server2abcdef";

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

const servers = async (serverIds: string[], email: string) =>
   (await reserve(serverIds, email))?.servers ?? null;

describe("invite email budget", () => {
   it("emails the same address on one server again only after the cooldown", async () => {
      expect(await servers([SERVER], "one@example.com")).toEqual([SERVER]);
      later(14 * MINUTE_MS);
      expect(await servers([SERVER], "one@example.com")).toBeNull();
      later(MINUTE_MS);
      expect(await servers([SERVER], "one@example.com")).toEqual([SERVER]);
   });

   it("does not spend the recipient's daily budget on a send the cooldown refused", async () => {
      await reserve([SERVER], "one@example.com");
      for (let i = 0; i < 5; i++) await reserve([SERVER], "one@example.com");
      expect(await servers([OTHER], "one@example.com")).toEqual([OTHER]);
      expect(await servers(["server3abcdef"], "one@example.com")).toEqual([
         "server3abcdef",
      ]);
      expect(await servers(["server4abcdef"], "one@example.com")).toBeNull();
   });

   it("spends the recipient's daily budget once for an email listing several servers", async () => {
      expect(await servers([SERVER, OTHER], "one@example.com")).toEqual([
         SERVER,
         OTHER,
      ]);
      expect(await servers(["server3abcdef"], "one@example.com")).toEqual([
         "server3abcdef",
      ]);
      expect(await servers(["server4abcdef"], "one@example.com")).toEqual([
         "server4abcdef",
      ]);
      expect(await servers(["server5abcdef"], "one@example.com")).toBeNull();
   });

   it("drops a server in its cooldown and keeps the others", async () => {
      await reserve([SERVER], "one@example.com");
      expect(await servers([SERVER, OTHER], "one@example.com")).toEqual([
         OTHER,
      ]);
   });

   it("drops a server past its daily cap without touching the others' budgets", async () => {
      for (let i = 0; i < 50; i++)
         await reserve([SERVER], `person${i}@example.com`);
      expect(await servers([SERVER, OTHER], "late@example.com")).toEqual([
         OTHER,
      ]);
      later(15 * MINUTE_MS);
      expect(await servers([OTHER], "late@example.com")).toEqual([OTHER]);
   });

   it("spends nothing when every server is refused", async () => {
      await reserve([SERVER, OTHER], "one@example.com");
      expect(await servers([SERVER, OTHER], "one@example.com")).toBeNull();
      expect(await servers(["server3abcdef"], "one@example.com")).toEqual([
         "server3abcdef",
      ]);
      expect(await servers(["server4abcdef"], "one@example.com")).toEqual([
         "server4abcdef",
      ]);
   });

   it("gives the budget back when a send fails", async () => {
      const first = await reserve([SERVER, OTHER], "one@example.com");
      await first!.release();
      expect(await servers([SERVER, OTHER], "one@example.com")).toEqual([
         SERVER,
         OTHER,
      ]);
   });

   it("resets the recipient budget a day later", async () => {
      for (const server of ["serverAabcdef", "serverBabcdef", "serverCabcdef"])
         await reserve([server], "victim+x@gmail.com");
      expect(await servers(["serverDabcdef"], "vic.tim@gmail.com")).toBeNull();
      later(24 * 60 * MINUTE_MS);
      expect(await servers(["serverDabcdef"], "vic.tim@gmail.com")).toEqual([
         "serverDabcdef",
      ]);
   });
});

describe("the shared store", () => {
   beforeEach(() => {
      db.store = "postgres";
   });

   const keys = () => db.hit.mock.calls.map(([key]) => String(key));

   it("keys counters by a hash of the canonical mailbox, never the address", async () => {
      db.hit.mockResolvedValue({ hits: 1, resetAt: new Date() });
      expect(
         await reserveInviteEmails([SERVER], "Victim+a@Gmail.com")
      ).not.toBe(null);
      expect(keys()).toHaveLength(3);
      expect(keys().join(" ")).not.toMatch(/victim|gmail/i);
      await reserveInviteEmails([OTHER], "victim+b@gmail.com");
      const recipientKeys = keys().filter((key) =>
         key.startsWith("invite-mail:to:")
      );
      expect(recipientKeys).toHaveLength(2);
      expect(new Set(recipientKeys).size).toBe(1);
   });

   it("hits the recipient counter once and each server's counters once", async () => {
      db.hit.mockResolvedValue({ hits: 1, resetAt: new Date() });
      await reserveInviteEmails([SERVER, OTHER], "one@example.com");
      expect(
         keys().filter((key) => key.startsWith("invite-mail:to:"))
      ).toHaveLength(1);
      expect(keys().filter((key) => key.includes(SERVER))).toHaveLength(2);
      expect(keys().filter((key) => key.includes(OTHER))).toHaveLength(2);
   });

   it("undoes the hits it took when the recipient budget is spent", async () => {
      db.hit.mockResolvedValueOnce({ hits: 4, resetAt: new Date() });
      expect(await reserveInviteEmails([SERVER], "one@example.com")).toBeNull();
      expect(db.hit).toHaveBeenCalledTimes(1);
      expect(db.undo.mock.calls.map(([key]) => key)).toEqual(keys());
   });

   it("undoes only the refused server's hits and keeps the rest", async () => {
      db.hit.mockImplementation(async (key: string) => ({
         hits: key.includes(`again:${SERVER}:`) ? 2 : 1,
         resetAt: new Date(),
      }));
      const reservation = await reserveInviteEmails(
         [SERVER, OTHER],
         "one@example.com"
      );
      expect(reservation?.servers).toEqual([OTHER]);
      expect(db.undo.mock.calls.map(([key]) => key)).toEqual([
         `invite-mail:again:${SERVER}:${keys()[0]!.slice("invite-mail:to:".length)}`,
      ]);
      await reservation!.release();
      expect(db.undo).toHaveBeenCalledTimes(4);
   });

   it("sends nothing when the store is unavailable", async () => {
      db.hit.mockRejectedValue(new Error("pool timeout"));
      expect(await reserveInviteEmails([SERVER], "one@example.com")).toBeNull();
      expect(
         vi
            .mocked(console.error)
            .mock.calls.some(([line]) =>
               String(line).includes("Invite email budget unavailable")
            )
      ).toBe(true);
   });
});
