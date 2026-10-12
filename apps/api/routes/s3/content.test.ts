import { errorHandler } from "@/lib/http";
import { privateNoStore } from "@/lib/middleware/cache-control";
import { MAX_EDIT_BYTES } from "@s3-viewer/types";
import express from "express";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   bucketMember,
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import { endpointStub } from "@/lib/testing/s3-fixture";
import { createReadBudget, readBudget } from "@/lib/s3/read-budget";
import { contentRouter } from "./content";
import {
   bufferedBodyReservationBytes,
   BUFFERED_BODY_SLAB_BYTES,
} from "@/lib/s3/buffered-body";

const state = vi.hoisted(() => ({
   actor: "actor12345",
   role: "OWNER" as "OWNER" | "VIEWER" | null,
   getClient: vi.fn(),
   audit: vi.fn(),
   metadata: {
      ContentType: "text/plain",
      ContentLength: 5,
      ETag: '"live"',
   } as Record<string, unknown>,
   body: "hello",
   object: null as { Body: Readable; ContentLength?: number } | null,
   abortSignal: null as AbortSignal | null,
   sends: [] as string[],
}));

vi.mock("@/lib/http", async (importOriginal) => {
   const actual = await importOriginal<typeof import("@/lib/http")>();
   return {
      ...actual,
      requestSignal: (...args: Parameters<typeof actual.requestSignal>) =>
         state.abortSignal ?? actual.requestSignal(...args),
   };
});
vi.mock("@s3-viewer/db", () => ({
   prisma: { $queryRaw: scopeQueryRaw(() => bucketMember(state.role)) },
}));
vi.mock("@/lib/s3/client-cache", () => ({ getS3Client: state.getClient }));
vi.mock("@/lib/middleware/audit-record", () => ({
   record: state.audit,
   recordMany: vi.fn(),
}));

const client = endpointStub(
   vi.fn(async (command: object) => {
      const name = command.constructor.name;
      state.sends.push(name);
      if (state.object) return state.object;
      return {
         Body: Readable.from([state.body]),
         ...state.metadata,
      };
   })
);

let base: string;
routeServer(
   (app) => {
      app.use((req, _res, next) => {
         req.headers["sec-fetch-site"] = "same-origin";
         next();
      });
      app.use(express.json());
      app.use(signedIn(() => ({ id: state.actor })));
      app.use(privateNoStore);
      app.use("/servers/:serverId/buckets/:bucketName/objects", contentRouter);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/server12345/buckets/backups/objects`;
   }
);
beforeEach(() => {
   state.role = "OWNER";
   state.sends = [];
   state.body = "hello";
   state.object = null;
   state.abortSignal = null;
   state.metadata = {
      ContentType: "text/plain",
      ContentLength: 5,
      ETag: '"live"',
   };
   state.getClient.mockReset().mockResolvedValue(client);
   state.audit.mockReset().mockResolvedValue(undefined);
   client.send.mockClear();
});

const get = (objectKey: string) =>
   fetch(`${base}/v3/content?objectKey=${encodeURIComponent(objectKey)}`);

describe("inline object content", () => {
   it("returns the body with the stored type, its ETag and no caching", async () => {
      const response = await get("notes/todo.txt");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/plain");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("etag")).toBe('"live"');
      expect(await response.text()).toBe("hello");
      expect(state.sends).toEqual(["GetObjectCommand"]);
      expect(client.send.mock.calls[0]?.[0]).toMatchObject({
         input: { Bucket: "backups", Key: "notes/todo.txt" },
      });
   });

   it("serves scriptable types as plain text", async () => {
      state.metadata = {
         ContentType: "text/html",
         ContentLength: 5,
         ETag: '"live"',
      };
      state.body = "<h1>x";
      const response = await get("page.html");
      expect(response.headers.get("content-type")).toBe("text/plain");
      expect(await response.text()).toBe("<h1>x");
   });

   it("hands svg over as a download rather than rendering it here", async () => {
      state.metadata = {
         ContentType: "image/svg+xml",
         ContentLength: 5,
         ETag: '"live"',
      };
      state.body = "<svg>";
      const response = await get("logo.svg");
      expect(response.headers.get("content-disposition")).toBe("attachment");
      expect(await response.text()).toBe("<svg>");
   });

   it("keeps ordinary text inline", async () => {
      expect(
         (await get("notes/todo.txt")).headers.get("content-disposition")
      ).toBe("inline");
   });

   it("records the read only once the object was found", async () => {
      await get("notes/todo.txt");
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            action: "object.view",
            bucket: "backups",
            target: "notes/todo.txt",
            detail: { size: 5, contentType: "text/plain" },
         })
      );
   });

   it("refuses a file too large to edit before reading it", async () => {
      state.metadata = {
         ContentType: "text/plain",
         ContentLength: 2 * 1024 * 1024,
      };
      const response = await get("huge.log");
      expect(response.status).toBe(413);
      expect(state.sends).toEqual(["GetObjectCommand"]);
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("closes an oversized GET without reading its body", async () => {
      const read = vi.fn();
      const body = new Readable({ read });
      state.object = { Body: body, ContentLength: MAX_EDIT_BYTES + 1 };
      const response = await get("huge.log");
      expect(response.status).toBe(413);
      expect(read).not.toHaveBeenCalled();
      expect(body.destroyed).toBe(true);
      expect(await response.json()).toMatchObject({
         message: expect.stringContaining("can't be edited"),
      });
   });

   it.each([-1, NaN, 1.5])(
      "refuses malformed GET length %s and closes the body",
      async (ContentLength) => {
         const body = new Readable({ read() {} });
         state.object = { Body: body, ContentLength };
         const response = await get("notes/todo.txt");
         expect(response.status).toBe(502);
         expect(body.destroyed).toBe(true);
      }
   );

   it.each([undefined, 1, MAX_EDIT_BYTES])(
      "bounds actual bytes when GET length is %s",
      async (ContentLength) => {
         const body = Readable.from([
            Buffer.alloc(MAX_EDIT_BYTES),
            Buffer.from("x"),
         ]);
         state.object = { Body: body, ContentLength };
         const response = await get("huge.log");
         expect(response.status).toBe(413);
         expect(response.headers.get("content-type")).toContain(
            "application/json"
         );
         expect(body.destroyed).toBe(true);
         expect(await response.json()).toMatchObject({
            message: expect.stringContaining("can't be edited"),
         });
      }
   );

   it("accepts exactly the editor limit without a GET length", async () => {
      const body = Readable.from([
         Buffer.alloc(MAX_EDIT_BYTES / 2),
         Buffer.alloc(MAX_EDIT_BYTES / 2),
      ]);
      state.object = { Body: body };
      const response = await get("limit.txt");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-length")).toBe(
         String(MAX_EDIT_BYTES)
      );
      expect((await response.arrayBuffer()).byteLength).toBe(MAX_EDIT_BYTES);
      expect(body.destroyed).toBe(true);
   });

   it.each([undefined, 1, 20])(
      "responds with the actual byte length when GET length is %s",
      async (ContentLength) => {
         state.object = {
            Body: Readable.from(["h\u00e9llo"]),
            ContentLength,
         };
         const response = await get("notes/todo.txt");
         expect(response.status).toBe(200);
         expect(response.headers.get("content-length")).toBe("6");
         expect(await response.text()).toBe("h\u00e9llo");
      }
   );

   it("returns an error before sending partial content when the GET fails", async () => {
      const body = Readable.from(
         (async function* () {
            yield Buffer.from("partial");
            throw new Error("upstream read failed");
         })()
      );
      state.object = { Body: body };
      const response = await get("notes/todo.txt");
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
         message: "Something went wrong",
      });
      expect(body.destroyed).toBe(true);
   });

   it("closes the GET body when the request signal expires during a read", async () => {
      const controller = new AbortController();
      state.abortSignal = controller.signal;
      let reading!: () => void;
      const started = new Promise<void>((resolve) => (reading = resolve));
      const body = new Readable({ read: () => reading() });
      state.object = { Body: body };
      const pending = get("notes/todo.txt");
      await started;
      controller.abort();
      expect((await pending).status).toBe(500);
      expect(body.destroyed).toBe(true);
   });

   it("closes the GET body when the caller disconnects during a read", async () => {
      let reading!: () => void;
      const started = new Promise<void>((resolve) => (reading = resolve));
      const body = new Readable({ read: () => reading() });
      const closed = new Promise<void>((resolve) =>
         body.once("close", resolve)
      );
      state.object = { Body: body };
      const controller = new AbortController();
      const pending = fetch(`${base}/v3/content?objectKey=notes.txt`, {
         signal: controller.signal,
      });
      await started;
      const rejected = expect(pending).rejects.toMatchObject({
         name: "AbortError",
      });
      controller.abort();
      await rejected;
      await closed;
      expect(body.destroyed).toBe(true);
   });

   it("refuses concurrent editor reads and releases admission after disconnect", async () => {
      const budget = createReadBudget({
         maxBytes: MAX_EDIT_BYTES * 4,
         maxUserBytes: MAX_EDIT_BYTES * 4,
         maxServerBytes: MAX_EDIT_BYTES * 4,
         maxReads: 1,
         maxUserReads: 1,
         maxServerReads: 1,
      });
      const admission = vi
         .spyOn(readBudget, "acquire")
         .mockImplementation(budget.acquire);
      let reading!: () => void;
      const started = new Promise<void>((resolve) => {
         reading = resolve;
      });
      const body = new Readable({ read: () => reading() });
      const closed = new Promise<void>((resolve) => {
         body.once("close", resolve);
      });
      state.object = { Body: body };
      const controller = new AbortController();
      const pending = fetch(`${base}/v3/content?objectKey=notes.txt`, {
         signal: controller.signal,
      });
      const rejected = expect(pending).rejects.toMatchObject({
         name: "AbortError",
      });
      try {
         await started;
         expect((await get("another.txt")).status).toBe(429);
         expect(state.sends).toEqual(["GetObjectCommand"]);
         controller.abort();
         await rejected;
         await closed;
         await vi.waitFor(() => {
            const slot = budget.acquire({
               userId: state.actor,
               serverId: "server12345",
            });
            slot.release();
         });
         state.object = null;
         expect((await get("notes.txt")).status).toBe(200);
      } finally {
         controller.abort();
         admission.mockRestore();
      }
   });

   it("destroys the editor body and releases its slot on memory exhaustion", async () => {
      const budget = createReadBudget({
         maxBytes: bufferedBodyReservationBytes(1),
         maxUserBytes: bufferedBodyReservationBytes(1),
         maxServerBytes: bufferedBodyReservationBytes(1),
         maxReads: 1,
         maxUserReads: 1,
         maxServerReads: 1,
      });
      const admission = vi
         .spyOn(readBudget, "acquire")
         .mockImplementation(budget.acquire);
      const body = Readable.from([Buffer.alloc(BUFFERED_BODY_SLAB_BYTES + 1)]);
      state.object = { Body: body };
      try {
         expect((await get("notes.txt")).status).toBe(429);
         expect(body.destroyed).toBe(true);
         expect(state.audit).not.toHaveBeenCalled();
         state.object = { Body: Readable.from(["x"]) };
         const response = await get("small.txt");
         expect(response.status).toBe(200);
         expect(await response.text()).toBe("x");
      } finally {
         admission.mockRestore();
      }
   });

   it("rejects a folder key", async () => {
      const response = await get("notes/");
      expect(response.status).toBe(400);
      expect(state.getClient).not.toHaveBeenCalled();
   });

   it("rejects a missing object key", async () => {
      expect((await fetch(`${base}/v3/content`)).status).toBe(400);
      expect(state.getClient).not.toHaveBeenCalled();
   });

   it("lets a viewer read but not a removed member", async () => {
      state.role = "VIEWER";
      expect((await get("notes/todo.txt")).status).toBe(200);
      state.role = null;
      expect((await get("notes/todo.txt")).status).toBe(404);
   });
});
