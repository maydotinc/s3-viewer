import { archiveTicketStore } from "@/lib/testing/archive-ticket-store";
import { errorHandler } from "@/lib/http";
import { privateNoStore } from "@/lib/middleware/cache-control";
import { UploadIdleError } from "@/lib/s3/progress-floor";
import express from "express";
import type { Writable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   bucketMember,
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import { endpointStub } from "@/lib/testing/s3-fixture";
import { archiveRouter } from "./archive";

const state = vi.hoisted(() => ({
   ticketStore: undefined as unknown as ReturnType<typeof archiveTicketStore>,
   actor: "actor12345",
   role: "OWNER" as "OWNER" | "VIEWER" | null,
   getClient: vi.fn(),
   collect: vi.fn(),
   stream: vi.fn(),
   audit: vi.fn(),
   acquire: vi.fn(),
   release: vi.fn(),
   responseClosed: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      $transaction: (
         work: Parameters<typeof state.ticketStore.$transaction>[0]
      ) => state.ticketStore.$transaction(work),
      archiveTicket: {
         findFirst: (
            args: Parameters<
               typeof state.ticketStore.archiveTicket.findFirst
            >[0]
         ) => state.ticketStore.archiveTicket.findFirst(args),
         updateMany: (
            args: Parameters<
               typeof state.ticketStore.archiveTicket.updateMany
            >[0]
         ) => state.ticketStore.archiveTicket.updateMany(args),
         deleteMany: (
            args: Parameters<
               typeof state.ticketStore.archiveTicket.deleteMany
            >[0]
         ) => state.ticketStore.archiveTicket.deleteMany(args),
      },
      $queryRaw: async (
         strings: TemplateStringsArray,
         ...values: unknown[]
      ) => {
         if (strings.join("").includes('DELETE FROM "archive_ticket"'))
            return state.ticketStore.$queryRaw(strings, ...values);
         return scopeQueryRaw(
            () => bucketMember(state.role, ["backups", "mirror"]),
            async () => [{ hits: 1, resetAt: new Date(Date.now() + 60_000) }]
         )(strings, ...values);
      },
      $executeRaw: async () => 0,
   },
}));
vi.mock("@/lib/s3/client-cache", () => ({ getS3Client: state.getClient }));
vi.mock("@/lib/s3/no-retry", () => ({
   withoutRetries: (client: unknown) => client,
   forCleanup: (client: unknown) => client,
}));
vi.mock("@/lib/s3/archive/entries", async (original) => ({
   ...(await original<typeof import("@/lib/s3/archive/entries")>()),
   collectArchiveEntries: state.collect,
}));
vi.mock("@/lib/s3/archive/stream", async (original) => ({
   ...(await original<typeof import("@/lib/s3/archive/stream")>()),
   streamArchive: state.stream,
}));
vi.mock("@/lib/s3/upload-budget", async (original) => ({
   ...(await original<typeof import("@/lib/s3/upload-budget")>()),
   uploadBudget: { acquire: state.acquire },
}));
vi.mock("@/lib/middleware/audit-record", () => ({
   record: state.audit,
   recordMany: vi.fn(),
}));

type StreamArgs = { output: Writable; beforeOutput: () => Promise<void> };

const client = endpointStub(vi.fn());

let origin: string;
routeServer(
   (app) => {
      app.use(express.json());
      app.use((_req, res, next) => {
         res.once("close", () => state.responseClosed());
         next();
      });
      app.use(signedIn(() => ({ id: state.actor })));
      app.use(privateNoStore);
      app.use("/servers/:serverId/buckets/:bucketName/objects", archiveRouter);
      app.use(errorHandler);
   },
   (listening) => {
      origin = listening;
   }
);
beforeEach(() => {
   state.ticketStore = archiveTicketStore();
   state.responseClosed.mockReset();
   state.actor = "actor12345";
   state.role = "OWNER";
   state.getClient.mockReset().mockResolvedValue(client);
   state.audit.mockReset().mockResolvedValue(undefined);
   state.collect.mockReset().mockResolvedValue({
      entries: [{ key: "logs/a.txt", name: "a.txt", size: 5 }],
      bytes: 5,
   });
   state.release.mockReset();
   state.acquire.mockReset().mockReturnValue(state.release);
   state.stream
      .mockReset()
      .mockImplementation(async ({ output, beforeOutput }: StreamArgs) => {
         await beforeOutput();
         output.end(Buffer.from("PKzip"));
      });
});

const path = (bucket = "backups") =>
   `${origin}/servers/server12345/buckets/${bucket}/objects/v3/archive`;

const request = (
   body: Record<string, unknown>,
   bucket?: string
): Promise<Response> =>
   fetch(path(bucket), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
   });

const ticketFor = async (
   objectKeys: string[] = ["logs/"],
   bucket?: string
): Promise<{ token: string; filename: string; expiresAt: string }> => {
   const response = await request(
      { expectedUserId: state.actor, objectKeys },
      bucket
   );
   expect(response.status).toBe(201);
   return response.json() as Promise<{
      token: string;
      filename: string;
      expiresAt: string;
   }>;
};

describe("requesting a zip", () => {
   it("returns a token, its expiry and the filename", async () => {
      const ticket = await ticketFor(["logs/"]);
      expect(ticket.filename).toBe("logs.zip");
      expect(ticket.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(ticket.token.length).toBeLessThanOrEqual(4096);
      expect(Date.parse(ticket.expiresAt) - Date.now()).toBeGreaterThan(
         4 * 60 * 1000
      );
      expect(state.collect).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         ["logs/"],
         expect.objectContaining({
            maxObjects: expect.any(Number),
            maxBytes: expect.any(Number),
         })
      );
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("keeps the ticket out of every cache", async () => {
      const response = await request({
         expectedUserId: state.actor,
         objectKeys: ["logs/"],
      });
      expect(response.status).toBe(201);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
   });

   it("names an archive of loose files after the bucket", async () => {
      expect((await ticketFor(["a.txt", "b.txt"])).filename).toBe(
         "backups.zip"
      );
   });

   it("passes a limit refusal through", async () => {
      const { ApiHttpError } = await import("@/lib/http");
      state.collect.mockRejectedValue(new ApiHttpError(413, "too many files"));
      const response = await request({
         expectedUserId: state.actor,
         objectKeys: ["logs/"],
      });
      expect(response.status).toBe(413);
   });

   it.each([
      ["a changed account", { expectedUserId: "other12345" }, 403],
      ["no initiating user", {}, 400],
      [
         "an empty selection",
         { expectedUserId: "actor12345", objectKeys: [] },
         400,
      ],
      [
         "duplicate keys",
         { expectedUserId: "actor12345", objectKeys: ["a.txt", "a.txt"] },
         400,
      ],
   ])("rejects %s", async (_name, body, status) => {
      const response = await request({ objectKeys: ["logs/"], ...body });
      expect(response.status).toBe(status);
      expect(state.collect).not.toHaveBeenCalled();
   });

   it("rejects a removed member", async () => {
      state.role = null;
      const response = await request({
         expectedUserId: state.actor,
         objectKeys: ["logs/"],
      });
      expect(response.status).toBe(404);
      expect(state.collect).not.toHaveBeenCalled();
   });

   it("meters the fan-out the way /exists does", async () => {
      const response = await request({
         expectedUserId: state.actor,
         objectKeys: ["logs/"],
      });
      expect(response.status).toBe(201);
      expect(response.headers.get("ratelimit-policy")).toBeTruthy();
   });
});

describe("downloading a zip", () => {
   it("records the read attempt before the archive is written", async () => {
      const { token } = await ticketFor(["logs/"]);
      const response = await fetch(`${path()}/${token}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/zip");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("content-disposition")).toContain(
         'filename="logs.zip"'
      );
      await response.arrayBuffer();
      expect(state.stream).toHaveBeenCalledWith(
         expect.objectContaining({
            beforeOutput: expect.any(Function),
            maxBytes: expect.any(Number),
            entries: [{ key: "logs/a.txt", name: "a.txt", size: 5 }],
         })
      );
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            action: "object.archive",
            bucket: "backups",
            target: "logs/",
            detail: { objects: 1, estimatedBytes: 5, outcome: "attempt" },
         })
      );
   });

   it("hands the download the sizes the ticket resolved", async () => {
      state.collect.mockResolvedValue({
         entries: [{ key: "notes.md", name: "notes.md", size: 5 }],
         bytes: 5,
         fileSizes: new Map([["notes.md", 5]]),
      });
      const { token } = await ticketFor(["notes.md", "logs/"]);
      await (await fetch(`${path()}/${token}`)).arrayBuffer();
      expect(state.collect).toHaveBeenLastCalledWith(
         expect.anything(),
         ["notes.md", "logs/"],
         expect.anything(),
         new Map([["notes.md", 5]]),
         expect.anything()
      );
   });

   it("spends a token exactly once", async () => {
      const { token } = await ticketFor();
      await (await fetch(`${path()}/${token}`)).arrayBuffer();
      const second = await fetch(`${path()}/${token}`);
      expect(second.status).toBe(404);
      expect(second.headers.get("content-type")).toContain("application/json");
      expect(state.stream).toHaveBeenCalledOnce();
   });

   it("answers a storage timeout when storage never sends the first byte", async () => {
      const { token } = await ticketFor();
      state.stream.mockRejectedValue(new UploadIdleError());
      const response = await fetch(`${path()}/${token}`);
      expect(response.status).toBe(504);
      await expect(response.json()).resolves.toMatchObject({
         message: "Storage did not answer in time. Try again.",
      });
   });

   it("keeps the ticket when storage fails before the zip starts", async () => {
      const { token } = await ticketFor();
      state.stream.mockRejectedValueOnce(new UploadIdleError());
      expect((await fetch(`${path()}/${token}`)).status).toBe(504);
      expect(state.audit).not.toHaveBeenCalled();
      expect(state.ticketStore.rows()[0]?.failures).toBe(1);
      const retried = await fetch(`${path()}/${token}`);
      expect(retried.status).toBe(200);
      await retried.arrayBuffer();
      expect(state.audit).toHaveBeenCalledOnce();
   });

   it("spends the ticket after three failures before the zip starts", async () => {
      const { token } = await ticketFor();
      state.stream.mockRejectedValue(new UploadIdleError());
      for (let attempt = 0; attempt < 3; attempt++)
         expect((await fetch(`${path()}/${token}`)).status).toBe(504);
      expect((await fetch(`${path()}/${token}`)).status).toBe(404);
      expect(state.stream).toHaveBeenCalledTimes(3);
   });

   it("refuses a token issued for another bucket", async () => {
      const { token } = await ticketFor(["logs/"], "backups");
      const response = await fetch(`${path("mirror")}/${token}`);
      expect(response.status).toBe(404);
      expect(state.stream).not.toHaveBeenCalled();
   });

   it("refuses a token presented by another account", async () => {
      const { token } = await ticketFor();
      state.actor = "other12345";
      expect((await fetch(`${path()}/${token}`)).status).toBe(404);
      expect(state.stream).not.toHaveBeenCalled();
   });

   it("refuses an unknown token without touching storage", async () => {
      const response = await fetch(`${path()}/${"z".repeat(32)}`);
      expect(response.status).toBe(404);
      expect(state.getClient).not.toHaveBeenCalled();
   });

   it("rejects a malformed token before authorizing", async () => {
      expect((await fetch(`${path()}/short`)).status).toBe(400);
   });

   it("rejects a removed member", async () => {
      const { token } = await ticketFor();
      state.role = null;
      expect((await fetch(`${path()}/${token}`)).status).toBe(404);
   });

   it("replays the entries the ticket collected instead of listing the folders again", async () => {
      const { token } = await ticketFor(["logs/", "notes.md"]);
      state.collect.mockClear().mockResolvedValue({
         entries: [
            { key: "logs/a.txt", name: "a.txt", size: 5 },
            { key: "logs/b.txt", name: "b.txt", size: 6 },
         ],
         bytes: 11,
      });
      await (await fetch(`${path()}/${token}`)).arrayBuffer();
      expect(state.collect).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         ["logs/", "notes.md"],
         expect.objectContaining({ maxObjects: expect.any(Number) }),
         undefined,
         [["logs/a.txt", 5]]
      );
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            detail: { objects: 2, estimatedBytes: 11, outcome: "attempt" },
         })
      );
   });

   it("lists again when the ticket was too large to carry its entries", async () => {
      state.collect.mockResolvedValue({
         entries: Array.from({ length: 5_000 }, (_, index) => ({
            key: `logs/${"k".repeat(40)}-${index}.bin`,
            name: `${index}.bin`,
            size: index,
         })),
         bytes: 1,
      });
      const { token } = await ticketFor(["logs/"]);
      state.collect.mockClear();
      await (await fetch(`${path()}/${token}`)).arrayBuffer();
      expect(state.collect).toHaveBeenCalledWith(
         expect.anything(),
         ["logs/"],
         expect.anything(),
         undefined,
         undefined
      );
   });

   it("holds the zip slot before it collects anything", async () => {
      const { token } = await ticketFor();
      let slotHeldWhenCollecting: boolean | undefined;
      state.collect.mockImplementation(async () => {
         slotHeldWhenCollecting =
            state.acquire.mock.calls.length > 0 &&
            state.release.mock.calls.length === 0;
         return { entries: [{ key: "a", name: "a", size: 1 }], bytes: 1 };
      });
      await (await fetch(`${path()}/${token}`)).arrayBuffer();
      expect(slotHeldWhenCollecting).toBe(true);
   });

   it("refuses a selection that outgrew its cap before the download", async () => {
      const { token } = await ticketFor();
      const { ApiHttpError } = await import("@/lib/http");
      state.collect.mockRejectedValue(new ApiHttpError(413, "too many files"));
      const response = await fetch(`${path()}/${token}`);
      expect(response.status).toBe(413);
      expect(state.stream).not.toHaveBeenCalled();
      expect(state.release).toHaveBeenCalledOnce();
   });

   it("reserves streaming memory from the zip pool and gives it back", async () => {
      const { ARCHIVE_POOL } = await import("@/lib/s3/upload-budget");
      const { token } = await ticketFor();
      await (await fetch(`${path()}/${token}`)).arrayBuffer();
      expect(state.acquire).toHaveBeenCalledWith(
         "actor12345",
         expect.any(Number),
         ARCHIVE_POOL,
         expect.any(String),
         "server12345"
      );
      expect(state.release).toHaveBeenCalledOnce();
   });

   it("answers 429 with a retry hint when memory is exhausted", async () => {
      const { token } = await ticketFor();
      const { ApiHttpError } = await import("@/lib/http");
      state.acquire.mockImplementation(() => {
         throw new ApiHttpError(429, "Upload capacity is busy.");
      });
      const response = await fetch(`${path()}/${token}`);
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("5");
      expect(response.headers.get("content-type")).toContain(
         "application/json"
      );
      expect(state.stream).not.toHaveBeenCalled();
      expect(state.audit).not.toHaveBeenCalled();
      expect(state.collect).toHaveBeenCalledOnce();
      expect(state.ticketStore.rows()[0]?.failures).toBe(0);
      state.acquire.mockReturnValue(state.release);
      const retried = await fetch(`${path()}/${token}`);
      expect(retried.status).toBe(200);
      await retried.arrayBuffer();
      expect(state.stream).toHaveBeenCalledOnce();
   });

   it("breaks the connection instead of finishing a partial zip", async () => {
      const { token } = await ticketFor();
      state.stream.mockImplementation(
         async ({ output, beforeOutput }: StreamArgs) => {
            await beforeOutput();
            output.write(Buffer.from("PKpartial"));
            await new Promise((resolve) => setTimeout(resolve, 5));
            throw new Error("storage went away");
         }
      );
      const response = await fetch(`${path()}/${token}`);
      expect(response.status).toBe(200);
      await expect(response.arrayBuffer()).rejects.toThrow();
      expect(state.audit).toHaveBeenCalledOnce();
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            detail: expect.objectContaining({ outcome: "attempt" }),
         })
      );
      expect(state.release).toHaveBeenCalledOnce();
   });
});

describe("archive ticket admission", () => {
   it("answers HEAD without spending the token or reading storage", async () => {
      const { token } = await ticketFor();
      state.collect.mockClear();
      state.getClient.mockClear();
      const response = await fetch(`${path()}/${token}`, { method: "HEAD" });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/zip");
      expect(state.collect).not.toHaveBeenCalled();
      expect(state.getClient).not.toHaveBeenCalled();
      expect(state.acquire).not.toHaveBeenCalled();
      expect(state.stream).not.toHaveBeenCalled();
      expect(state.audit).not.toHaveBeenCalled();
      const downloaded = await fetch(`${path()}/${token}`);
      expect(downloaded.status).toBe(200);
      await downloaded.arrayBuffer();
      expect(state.stream).toHaveBeenCalledOnce();
   });

   it("admits exactly one of two concurrent redemptions", async () => {
      const { token } = await ticketFor();
      let collected = 0;
      let releaseCollection: () => void;
      const ready = new Promise<void>((resolve) => {
         releaseCollection = resolve;
      });
      state.collect.mockImplementation(async () => {
         if (++collected === 2) releaseCollection();
         await ready;
         return { entries: [{ key: "a", name: "a", size: 1 }], bytes: 1 };
      });
      const responses = await Promise.all([
         fetch(`${path()}/${token}`),
         fetch(`${path()}/${token}`),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
         200, 404,
      ]);
      await Promise.all(responses.map((response) => response.arrayBuffer()));
      expect(state.audit).toHaveBeenCalledOnce();
      expect(state.release).toHaveBeenCalledTimes(2);
   });
});

it("stops before storage and preserves a ticket when the download disconnects during the shared ticket read", async () => {
   const { token } = await ticketFor();
   state.getClient.mockClear();
   state.responseClosed.mockClear();
   const { promise: reading, resolve: started } = Promise.withResolvers<void>();
   const { promise: pending, resolve: release } = Promise.withResolvers<void>();
   const original = state.ticketStore.archiveTicket.findFirst;
   const read = vi
      .spyOn(state.ticketStore.archiveTicket, "findFirst")
      .mockImplementation(async (args) => {
         started();
         await pending;
         return original(args);
      });
   const controller = new AbortController();
   const request = fetch(`${path()}/${token}`, { signal: controller.signal });
   const aborted = expect(request).rejects.toMatchObject({
      name: "AbortError",
   });
   await reading;
   controller.abort();
   await aborted;
   await vi.waitFor(() => expect(state.responseClosed).toHaveBeenCalled());
   release();
   read.mockRestore();
   await new Promise((resolve) => setImmediate(resolve));
   expect(state.getClient).not.toHaveBeenCalled();
   expect(state.ticketStore.rows()).toHaveLength(1);
});
