import { archiveTicketStore } from "@/lib/testing/archive-ticket-store";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   createArchiveTicket,
   readArchiveTicket,
   takeArchiveTicket,
} from "./ticket";

const state = vi.hoisted(() => ({
   store: undefined as unknown as ReturnType<typeof archiveTicketStore>,
}));
vi.mock("@s3-viewer/db", () => ({
   prisma: new Proxy(
      {},
      { get: (_target, key) => state.store[key as keyof typeof state.store] }
   ),
}));

const ticket = {
   userId: "user12345",
   serverId: "server12345",
   bucket: "bucket",
   objectKeys: ["logs/"],
};
const binding = {
   userId: ticket.userId,
   serverId: ticket.serverId,
   bucket: ticket.bucket,
};
const bulky = {
   ...ticket,
   objectKeys: Array.from(
      { length: 200 },
      () => `logs/${randomBytes(24).toString("hex")}.bin`
   ),
};
const otherReplica = async (): Promise<typeof import("./ticket")> => {
   vi.resetModules();
   return import("./ticket");
};

describe("shared archive tickets", () => {
   beforeEach(() => {
      state.store = archiveTicketStore();
   });
   afterEach(() => {
      vi.useRealTimers();
      vi.resetModules();
   });

   it.each([ticket, bulky])(
      "redeems small and large selections across replicas exactly once",
      async (request) => {
         const { token } = await createArchiveTicket(request);
         const replica = await otherReplica();
         expect(await replica.readArchiveTicket(token, binding)).toMatchObject({
            objectKeys: request.objectKeys,
         });
         const outcomes = await Promise.allSettled([
            replica.takeArchiveTicket(token, binding),
            takeArchiveTicket(token, binding),
         ]);
         expect(
            outcomes.filter((outcome) => outcome.status === "fulfilled")
         ).toHaveLength(1);
         await expect(
            replica.takeArchiveTicket(token, binding)
         ).rejects.toMatchObject({ status: 404 });
         await expect(readArchiveTicket(token, binding)).rejects.toMatchObject({
            status: 404,
         });
      }
   );

   it("carries the collected manifest so redemption need not list again", async () => {
      const manifest = [
         ["logs/a.bin", 10],
         ["logs/b.bin", 20],
      ] as const;
      const { token } = await createArchiveTicket({ ...ticket, manifest });
      expect(await readArchiveTicket(token, binding)).toMatchObject({
         manifest,
      });
      const { token: plain } = await createArchiveTicket(ticket);
      expect(
         (await readArchiveTicket(plain, binding)).manifest
      ).toBeUndefined();
   });

   it("leaves out a manifest too large to keep and still issues the ticket", async () => {
      const manifest = Array.from(
         { length: 4_000 },
         (_, index) =>
            [
               `logs/${randomBytes(24).toString("hex")}-${index}.bin`,
               index,
            ] as const
      );
      const { token } = await createArchiveTicket({ ...ticket, manifest });
      const read = await readArchiveTicket(token, binding);
      expect(read.objectKeys).toEqual(ticket.objectKeys);
      expect(read.manifest).toBeUndefined();
   });

   it("stores a digest rather than the bearer token", async () => {
      const { token } = await createArchiveTicket(ticket);
      expect(token).toHaveLength(43);
      expect(state.store.rows()[0]!.id).not.toContain(token);
      expect(JSON.stringify(state.store.rows())).not.toContain(token);
      await expect(
         takeArchiveTicket(token.slice(1), binding)
      ).rejects.toMatchObject({ status: 404 });
      await expect(
         takeArchiveTicket(`${token.slice(0, -1)}!`, binding)
      ).rejects.toMatchObject({ status: 404 });
   });

   it.each([
      ["another user", { ...binding, userId: "other12345" }],
      ["another server", { ...binding, serverId: "other12345" }],
      ["another bucket", { ...binding, bucket: "other" }],
   ])("does not consume a ticket presented by %s", async (_name, wrong) => {
      const { token } = await createArchiveTicket(ticket);
      await expect(takeArchiveTicket(token, wrong)).rejects.toMatchObject({
         status: 404,
      });
      await expect(readArchiveTicket(token, binding)).resolves.toMatchObject({
         filename: "logs.zip",
         target: "logs/",
      });
      await expect(takeArchiveTicket(token, binding)).resolves.toBeUndefined();
   });

   it("expires at the five-minute boundary and prunes expired capacity", async () => {
      vi.useFakeTimers();
      const { token, expiresAt } = await createArchiveTicket(ticket);
      expect(expiresAt.getTime() - Date.now()).toBe(5 * 60 * 1000);
      vi.advanceTimersByTime(5 * 60 * 1000);
      await expect(readArchiveTicket(token, binding)).rejects.toMatchObject({
         status: 404,
      });
      await expect(takeArchiveTicket(token, binding)).rejects.toMatchObject({
         status: 404,
      });
      await createArchiveTicket(ticket);
      expect(state.store.rows()).toHaveLength(1);
   });

   it("owns the selection and relevant known sizes independently of its caller", async () => {
      const objectKeys = [...bulky.objectKeys];
      const fileSizes = new Map([
         [objectKeys[0]!, 42],
         ["unrelated", 99],
      ]);
      const { token } = await createArchiveTicket({
         ...bulky,
         objectKeys,
         fileSizes,
      });
      objectKeys[0] = "changed";
      fileSizes.clear();
      expect(await readArchiveTicket(token, binding)).toMatchObject({
         objectKeys: bulky.objectKeys,
         fileSizes: new Map([[bulky.objectKeys[0]!, 42]]),
      });
   });

   it("evicts only the same user's oldest outstanding ticket", async () => {
      vi.useFakeTimers();
      const mine = [];
      for (let index = 0; index < 6; index++) {
         mine.push(await createArchiveTicket(ticket));
         vi.advanceTimersByTime(1);
      }
      const theirs = await createArchiveTicket({
         ...ticket,
         userId: "other12345",
      });
      await expect(
         takeArchiveTicket(mine[0]!.token, binding)
      ).rejects.toMatchObject({ status: 404 });
      for (const { token } of mine.slice(1))
         await takeArchiveTicket(token, binding);
      await expect(
         takeArchiveTicket(theirs.token, { ...binding, userId: "other12345" })
      ).resolves.toBeUndefined();
   });

   it("bounds shared count, including concurrent admissions, and releases consumed capacity", async () => {
      const requests = Array.from({ length: 1_001 }, (_, index) => ({
         ...ticket,
         userId: `user-${index}`,
         serverId: `server-${index % 10}`,
      }));
      const outcomes = await Promise.allSettled(
         requests.map(createArchiveTicket)
      );
      expect(
         outcomes.filter((outcome) => outcome.status === "fulfilled")
      ).toHaveLength(1_000);
      expect(outcomes.at(-1)).toMatchObject({
         status: "rejected",
         reason: { status: 503 },
      });
      const first = outcomes[0];
      if (first?.status !== "fulfilled")
         throw new Error("First ticket was refused");
      await takeArchiveTicket(first.value.token, {
         ...binding,
         userId: "user-0",
         serverId: "server-0",
      });
      await expect(
         createArchiveTicket({
            ...ticket,
            userId: "overflow",
            serverId: "server-0",
         })
      ).resolves.toBeDefined();
   });

   it("bounds total bytes and rolls back eviction if a replacement cannot fit", async () => {
      vi.useFakeTimers();
      const large = Array.from(
         { length: 980 },
         (_, index) => `${index}-${"x".repeat(1_000)}`
      );
      const fileSizes = new Map(large.map((key) => [key, 1]));
      for (let index = 0; ; index++) {
         try {
            await createArchiveTicket({
               ...ticket,
               userId: `large-${index}`,
               serverId: `server-${index % 10}`,
               objectKeys: large,
               fileSizes,
            });
         } catch (error) {
            expect(error).toMatchObject({ status: 503 });
            break;
         }
         expect(index).toBeLessThan(80);
      }
      const issued = [];
      for (let index = 0; index < 5; index++) {
         issued.push(await createArchiveTicket(ticket));
         vi.advanceTimersByTime(1);
      }
      await expect(
         createArchiveTicket({ ...ticket, objectKeys: large, fileSizes })
      ).rejects.toMatchObject({ status: 503 });
      for (const { token } of issued)
         await expect(
            takeArchiveTicket(token, binding)
         ).resolves.toBeUndefined();
   });

   it("keeps one server to a fifth of the shared count", async () => {
      for (let index = 0; index < 200; index++)
         await createArchiveTicket({ ...ticket, userId: `member-${index}` });
      await expect(
         createArchiveTicket({ ...ticket, userId: "one-more" })
      ).rejects.toMatchObject({ status: 503 });
      await expect(
         createArchiveTicket({
            ...ticket,
            userId: "one-more",
            serverId: "elsewhere12345",
         })
      ).resolves.toBeDefined();
   });

   it("keeps one server to a fifth of the shared bytes", async () => {
      const large = Array.from(
         { length: 980 },
         (_, index) => `${index}-${"x".repeat(1_000)}`
      );
      let admitted = 0;
      for (;;) {
         try {
            await createArchiveTicket({
               ...ticket,
               userId: `large-${admitted}`,
               objectKeys: large,
            });
            admitted++;
         } catch (error) {
            expect(error).toMatchObject({ status: 503 });
            break;
         }
         expect(admitted).toBeLessThan(20);
      }
      const held = state.store.rows().reduce((sum, row) => sum + row.bytes, 0);
      expect(held).toBeLessThanOrEqual(64 * 1024 * 1024 * 0.2);
      expect(admitted).toBeGreaterThan(0);
      await expect(
         createArchiveTicket({
            ...ticket,
            userId: "large-elsewhere",
            serverId: "elsewhere12345",
            objectKeys: large,
         })
      ).resolves.toBeDefined();
   });
});
