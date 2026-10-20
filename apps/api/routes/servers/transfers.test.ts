import { S3_ROUTE_TIMEOUT_MS, copyWorkMs } from "@/lib/constants";
import { GIB, MAX_MULTIPART_PARTS } from "@s3-viewer/types";
import express, { type ErrorRequestHandler } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { ApiHttpError, errorHandler } from "@/lib/http";
import { plannedPartSize, streamedUploadCap } from "@/lib/s3/upload";
import { routeServer, signedIn } from "@/lib/testing/route-harness";
import { UnconfirmedWriteError } from "@/lib/s3/conditions";
import { endpointStub } from "@/lib/testing/s3-fixture";
import { authorizeScopeRows } from "@/lib/testing/scope-probe";
import { transfersRouter } from "./transfers";

const SOURCE_SERVER = "serverone123";
const OTHER_SERVER = "servertwo123";

type Grants = Record<string, "VIEWER" | "EDITOR" | undefined>;

type ServerAudit = { auditEnabled: boolean; auditLevel: string };

const state = vi.hoisted(() => ({
   actor: "actor12345",
   members: [] as string[],
   grants: {} as Record<string, "VIEWER" | "EDITOR" | undefined>,
   serverAudit: {} as Record<
      string,
      { auditEnabled: boolean; auditLevel: string }
   >,
   getClient: vi.fn(),
   head: vi.fn(),
   copy: vi.fn(),
   transfer: vi.fn(),
   audit: vi.fn(),
   writeAudits: vi.fn(),
   send: vi.fn(),
   requestSignal: vi.fn(),
   responseClosed: vi.fn(),
   routeError: vi.fn(),
   maxUploadBytes: undefined as number | undefined,
}));

vi.mock("@/lib/env", async (original) => {
   const actual = await original<typeof import("@/lib/env")>();
   return {
      ...actual,
      env: {
         ...actual.env,
         get MAX_UPLOAD_BYTES() {
            return state.maxUploadBytes ?? actual.env.MAX_UPLOAD_BYTES;
         },
      },
   };
});

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      $queryRaw: async (
         strings: TemplateStringsArray,
         ...values: unknown[]
      ) => {
         const rows = authorizeScopeRows(strings, values, ({ serverId }) => {
            if (!state.members.includes(serverId)) return null;
            const audit: ServerAudit = state.serverAudit[serverId] ?? {
               auditEnabled: false,
               auditLevel: "ALL",
            };
            return {
               role: "VIEWER",
               auditEnabled: audit.auditEnabled,
               auditLevel: audit.auditLevel as "ALL" | "CHANGES",
               allowedBuckets: [],
               restrictedBuckets: false,
               grants: Object.entries(state.grants).flatMap(([key, role]) => {
                  const [server, bucketName] = key.split("/");
                  return role && server === serverId && bucketName
                     ? [{ bucketName, role }]
                     : [];
               }),
            };
         });
         if (!rows) throw new Error("unexpected raw query in transfers tests");
         return rows.map((row) => ({
            ...row,
            credentials: values.includes(OTHER_SERVER)
               ? "destination-sealed"
               : "source-sealed",
            provider: "S3",
            ownerId: "owner12345",
         }));
      },
   },
}));
vi.mock("@/lib/s3/client-cache", () => ({ getS3Client: state.getClient }));
vi.mock("@/lib/s3/copy", () => ({ copyObject: state.copy }));
vi.mock("@/lib/s3/object-metadata", () => ({ headReviewed: state.head }));
vi.mock("@/lib/s3/transfer", () => ({ transferObject: state.transfer }));
vi.mock("@/lib/http", async (original) => {
   const actual = await original<typeof import("@/lib/http")>();
   state.requestSignal.mockImplementation(actual.requestSignal);
   return { ...actual, requestSignal: state.requestSignal };
});
vi.mock("@/lib/s3/no-retry", () => ({
   withoutRetries: (client: unknown) => client,
   forCleanup: (client: unknown) => client,
}));
vi.mock("@/lib/middleware/audit-record", async (importOriginal) => ({
   ...(await importOriginal<typeof import("@/lib/middleware/audit-record")>()),
   record: state.audit,
   recordMany: vi.fn(),
}));
vi.mock("@/lib/audit/writer", async (importOriginal) => ({
   ...(await importOriginal<typeof import("@/lib/audit/writer")>()),
   writeAudits: state.writeAudits,
}));

const awsClient = endpointStub(state.send);

let base: string;
routeServer(
   (app) => {
      app.use(express.json({ limit: "1mb" }));
      app.use((_req, res, next) => {
         res.once("close", () => state.responseClosed());
         next();
      });
      app.use(signedIn(() => ({ id: state.actor })));
      app.use("/servers", transfersRouter);
      const reportError: ErrorRequestHandler = (error, _req, _res, next) => {
         state.routeError(error);
         next(error);
      };
      app.use(reportError);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers`;
   }
);
beforeEach(() => {
   state.actor = "actor12345";
   state.maxUploadBytes = undefined;
   state.members = [SOURCE_SERVER, OTHER_SERVER];
   state.grants = {
      [`${SOURCE_SERVER}/from-bucket`]: "VIEWER",
      [`${SOURCE_SERVER}/to-bucket`]: "EDITOR",
      [`${OTHER_SERVER}/to-bucket`]: "EDITOR",
   } satisfies Grants;
   state.serverAudit = {
      [SOURCE_SERVER]: { auditEnabled: false, auditLevel: "ALL" },
      [OTHER_SERVER]: { auditEnabled: false, auditLevel: "ALL" },
   };
   state.requestSignal.mockClear();
   state.responseClosed.mockReset();
   state.routeError.mockReset();
   state.getClient.mockReset().mockResolvedValue(awsClient);
   state.audit.mockReset().mockResolvedValue(undefined);
   state.writeAudits.mockReset().mockResolvedValue(undefined);
   state.head.mockReset().mockResolvedValue({
      ETag: '"reviewed"',
      ContentLength: 42,
   });
   state.copy.mockReset().mockResolvedValue({ eTag: '"copied"', size: 42 });
   state.transfer
      .mockReset()
      .mockResolvedValue({ eTag: '"streamed"', size: 42 });
   state.send.mockReset().mockResolvedValue({ ETag: '"reviewed"' });
});

const body = (overrides: Record<string, unknown> = {}) => ({
   expectedUserId: state.actor,
   source: {
      bucketName: "from-bucket",
      objectKey: "reports/q3.csv",
      expectedETag: '"reviewed"',
   },
   destination: {
      serverId: SOURCE_SERVER,
      bucketName: "to-bucket",
      objectKey: "imported/q3.csv",
   },
   overwrite: false,
   ...overrides,
});

const post = (overrides: Record<string, unknown> = {}) =>
   fetch(`${base}/${SOURCE_SERVER}/transfers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body(overrides)),
   });

const expectNoStorage = () => {
   expect(state.getClient).not.toHaveBeenCalled();
   expect(state.copy).not.toHaveBeenCalled();
   expect(state.transfer).not.toHaveBeenCalled();
   expect(state.audit).not.toHaveBeenCalled();
   expect(state.writeAudits).not.toHaveBeenCalled();
};

describe("copying between buckets on one server", () => {
   it("does not resolve the destination after disconnecting during the source HEAD", async () => {
      let release!: () => void;
      state.head.mockImplementationOnce(
         () =>
            new Promise((resolve) => {
               release = () =>
                  resolve({ ETag: '"reviewed"', ContentLength: 42 });
            })
      );
      const controller = new AbortController();
      const response = fetch(`${base}/${SOURCE_SERVER}/transfers`, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify(body()),
         signal: controller.signal,
      }).catch(() => undefined);
      try {
         await vi.waitFor(() => expect(state.head).toHaveBeenCalledOnce());
         controller.abort();
         await response;
         await vi.waitFor(() =>
            expect(state.responseClosed).toHaveBeenCalledOnce()
         );
      } finally {
         release?.();
      }
      await vi.waitFor(() => expect(state.routeError).toHaveBeenCalledOnce());
      expect(state.routeError).toHaveBeenCalledWith(
         expect.objectContaining({ name: "AbortError" })
      );
      expect(state.getClient).toHaveBeenCalledOnce();
      expect(state.getClient.mock.calls[0]?.[1]).toBe("from-bucket");
      expect(state.getClient.mock.calls[0]?.[2].aborted).toBe(true);
      expect(state.copy).not.toHaveBeenCalled();
      expect(state.transfer).not.toHaveBeenCalled();
   });

   it("audits a server-side copy cut off after storage received it as unconfirmed", async () => {
      state.copy.mockRejectedValue(new UnconfirmedWriteError());
      expect((await post()).status).toBe(502);
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            action: "object.transfer",
            target: "imported/q3.csv",
            detail: expect.objectContaining({ confirmed: false }),
         })
      );
   });

   it("runs a server-side copy from the source bucket and audits it", async () => {
      const response = await post();
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
         key: "imported/q3.csv",
         size: 42,
         eTag: '"copied"',
      });
      expect(state.copy).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "to-bucket" }),
         "S3",
         expect.objectContaining({
            sourceBucket: "from-bucket",
            sourceKey: "reports/q3.csv",
            destinationKey: "imported/q3.csv",
            sourceETag: '"reviewed"',
            overwrite: false,
         })
      );
      expect(state.transfer).not.toHaveBeenCalled();
      expect(state.getClient).toHaveBeenNthCalledWith(
         1,
         expect.objectContaining({
            serverId: SOURCE_SERVER,
            credentials: {
               credentials: "source-sealed",
               provider: "S3",
               ownerId: "owner12345",
            },
         }),
         "from-bucket",
         expect.any(AbortSignal)
      );
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            action: "object.transfer",
            bucket: "to-bucket",
            target: "imported/q3.csv",
            detail: {
               fromServerId: SOURCE_SERVER,
               fromBucket: "from-bucket",
               from: "reports/q3.csv",
            },
         })
      );
      expect(state.writeAudits).toHaveBeenCalledWith(
         expect.objectContaining({
            serverId: SOURCE_SERVER,
            entries: [
               expect.objectContaining({
                  action: "object.download",
                  bucket: "from-bucket",
                  target: "reports/q3.csv",
                  detail: {
                     outcome: "attempt",
                     toServerId: SOURCE_SERVER,
                     toBucket: "to-bucket",
                  },
               }),
            ],
         })
      );
   });

   it("hands the copy the source bucket's own client for its grant and tag reads", async () => {
      const sourceClient = { ...awsClient };
      state.getClient.mockImplementation(async (_auth, bucket) =>
         bucket === "from-bucket" ? sourceClient : awsClient
      );
      expect((await post()).status).toBe(201);
      expect(state.copy.mock.calls[0]?.[0].client).toBe(awsClient);
      expect(state.copy.mock.calls[0]?.[2].sourceClient).toBe(sourceClient);
   });

   it("reads the live ETag when the listing did not carry one", async () => {
      const response = await post({
         source: {
            bucketName: "from-bucket",
            objectKey: "reports/q3.csv",
            expectedETag: null,
         },
      });
      expect(response.status).toBe(201);
      expect(state.head).not.toHaveBeenCalled();
      expect(state.copy.mock.calls[0]?.[2]).toMatchObject({
         sourceETag: '"reviewed"',
      });
   });

   it("passes the overwrite choice through to the copy", async () => {
      await post({ overwrite: true });
      expect(state.copy.mock.calls[0]?.[2]).toMatchObject({ overwrite: true });
   });

   it("gives a large copy a deadline sized to the object, not the route", async () => {
      state.head.mockResolvedValue({
         ETag: '"reviewed"',
         ContentLength: 10 * GIB,
      });
      const response = await post();
      expect(response.status).toBe(201);
      const deadline = copyWorkMs(10 * GIB);
      expect(deadline).toBeGreaterThan(S3_ROUTE_TIMEOUT_MS);
      expect(state.requestSignal).toHaveBeenLastCalledWith(
         expect.anything(),
         deadline
      );
      const { signal } = state.copy.mock.calls[0]![0] as {
         signal: AbortSignal;
      };
      expect(signal).toBe(state.requestSignal.mock.results.at(-1)!.value);
      expect(signal.aborted).toBe(false);
   });

   it("keeps the route timeout for a small copy", async () => {
      await post();
      expect(state.requestSignal).toHaveBeenLastCalledWith(
         expect.anything(),
         S3_ROUTE_TIMEOUT_MS
      );
   });
});

describe("streaming between servers", () => {
   it("streams when the destination lives on another server", async () => {
      const response = await post({
         destination: {
            serverId: OTHER_SERVER,
            bucketName: "to-bucket",
            objectKey: "imported/q3.csv",
         },
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ eTag: '"streamed"' });
      expect(state.copy).not.toHaveBeenCalled();
      expect(state.getClient).toHaveBeenNthCalledWith(
         1,
         expect.objectContaining({
            serverId: SOURCE_SERVER,
            credentials: {
               credentials: "source-sealed",
               provider: "S3",
               ownerId: "owner12345",
            },
         }),
         "from-bucket",
         expect.any(AbortSignal)
      );
      expect(state.getClient).toHaveBeenNthCalledWith(
         2,
         expect.objectContaining({
            serverId: OTHER_SERVER,
            credentials: {
               credentials: "destination-sealed",
               provider: "S3",
               ownerId: "owner12345",
            },
         }),
         "to-bucket",
         expect.any(AbortSignal)
      );
      expect(state.transfer).toHaveBeenCalledWith(
         expect.objectContaining({
            source: expect.objectContaining({
               bucket: "from-bucket",
               key: "reports/q3.csv",
               expectedETag: '"reviewed"',
            }),
            destination: expect.objectContaining({
               bucket: "to-bucket",
               key: "imported/q3.csv",
            }),
            overwrite: false,
         })
      );
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            detail: expect.objectContaining({ fromServerId: SOURCE_SERVER }),
         })
      );
   });
});

describe("part sizing for a transfer between servers", () => {
   const crossServer = {
      destination: {
         serverId: OTHER_SERVER,
         bucketName: "to-bucket",
         objectKey: "imported/q3.csv",
      },
   };
   const sized = (ContentLength: number | undefined) =>
      state.head.mockResolvedValue({ ETag: '"reviewed"', ContentLength });

   it("checks the reviewed source once before taking an upload slot", async () => {
      expect((await post(crossServer)).status).toBe(201);
      expect(state.head).toHaveBeenCalledExactlyOnceWith(
         expect.objectContaining({ bucket: "from-bucket" }),
         "reports/q3.csv",
         '"reviewed"'
      );
      expect(state.transfer.mock.calls[0]?.[0].source.client).toBe(
         state.head.mock.calls[0]?.[0].client
      );
      expect(state.transfer.mock.calls[0]?.[0].source.head).toBe(
         await state.head.mock.results[0]?.value
      );
   });

   it.each([42, undefined])(
      "keeps the configured part size for a source of %s bytes",
      async (size) => {
         sized(size);
         expect((await post(crossServer)).status).toBe(201);
         expect(state.transfer.mock.calls[0]?.[0]).toMatchObject({
            partSize: env.UPLOAD_PART_BYTES,
            maxBytes: streamedUploadCap(env.UPLOAD_PART_BYTES),
         });
      }
   );

   it("grows the parts so an object that uploads may hold can be transferred", async () => {
      state.maxUploadBytes = 100 * GIB;
      const size = 60 * GIB;
      expect(size).toBeGreaterThan(MAX_MULTIPART_PARTS * env.UPLOAD_PART_BYTES);
      sized(size);
      expect((await post(crossServer)).status).toBe(201);
      const { partSize, maxBytes } = state.transfer.mock.calls[0]![0] as {
         partSize: number;
         maxBytes: number;
      };
      expect(partSize).toBe(plannedPartSize(size));
      expect(partSize * MAX_MULTIPART_PARTS).toBeGreaterThanOrEqual(size);
      expect(maxBytes).toBeGreaterThanOrEqual(size);
      expect(maxBytes).toBeLessThanOrEqual(100 * GIB);
   });

   it("refuses a source over the size cap before taking a slot or a destination client", async () => {
      sized(env.MAX_UPLOAD_BYTES + 1);
      const response = await post(crossServer);
      expect(response.status).toBe(413);
      expect((await response.json()).message).toBe(
         `Transfers are limited to ${env.MAX_UPLOAD_BYTES} bytes`
      );
      expect(state.transfer).not.toHaveBeenCalled();
      expect(state.getClient).toHaveBeenCalledOnce();
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("stops at a source that changed since it was reviewed", async () => {
      state.head.mockRejectedValue(
         new ApiHttpError(409, "The file changed. Refresh and try again.")
      );
      expect((await post(crossServer)).status).toBe(409);
      expect(state.transfer).not.toHaveBeenCalled();
   });
});

describe("auditing both ends of a transfer", () => {
   const crossServerBody = {
      destination: {
         serverId: OTHER_SERVER,
         bucketName: "to-bucket",
         objectKey: "imported/q3.csv",
      },
   };

   it("writes a row on both the source and destination servers", async () => {
      state.serverAudit[SOURCE_SERVER] = {
         auditEnabled: true,
         auditLevel: "ALL",
      };
      state.serverAudit[OTHER_SERVER] = {
         auditEnabled: true,
         auditLevel: "ALL",
      };
      const response = await post(crossServerBody);
      expect(response.status).toBe(201);
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            action: "object.transfer",
            bucket: "to-bucket",
            target: "imported/q3.csv",
         })
      );
      expect(state.writeAudits).toHaveBeenCalledWith(
         expect.objectContaining({
            serverId: SOURCE_SERVER,
            audit: { enabled: true, level: "ALL" },
            entries: [
               expect.objectContaining({
                  action: "object.download",
                  bucket: "from-bucket",
                  target: "reports/q3.csv",
                  detail: {
                     outcome: "attempt",
                     toServerId: OTHER_SERVER,
                     toBucket: "to-bucket",
                  },
               }),
            ],
         })
      );
   });

   it("records the authorized read before a destination receives bytes then fails", async () => {
      state.serverAudit[SOURCE_SERVER] = {
         auditEnabled: true,
         auditLevel: "CHANGES",
      };
      let received = "";
      state.transfer.mockImplementation(async () => {
         expect(state.writeAudits).toHaveBeenCalledWith(
            expect.objectContaining({
               serverId: SOURCE_SERVER,
               audit: { enabled: true, level: "CHANGES" },
               entries: [
                  expect.objectContaining({
                     action: "object.download",
                     detail: expect.objectContaining({ outcome: "attempt" }),
                  }),
               ],
            })
         );
         received = "source bytes";
         throw new Error("Destination disconnected after reading");
      });
      expect((await post(crossServerBody)).status).toBe(502);
      expect(received).toBe("source bytes");
      expect(state.writeAudits).toHaveBeenCalledOnce();
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("still records the source row when only the source has auditing on", async () => {
      state.serverAudit[SOURCE_SERVER] = {
         auditEnabled: true,
         auditLevel: "ALL",
      };
      state.serverAudit[OTHER_SERVER] = {
         auditEnabled: false,
         auditLevel: "ALL",
      };
      const response = await post(crossServerBody);
      expect(response.status).toBe(201);
      expect(state.writeAudits).toHaveBeenCalledWith(
         expect.objectContaining({
            serverId: SOURCE_SERVER,
            audit: { enabled: true, level: "ALL" },
         })
      );
      expect(state.audit.mock.calls[0]?.[0].locals.auth).toMatchObject({
         audit: { enabled: false, level: "ALL" },
      });
   });

   it("still records the destination row when only the destination has auditing on", async () => {
      state.serverAudit[SOURCE_SERVER] = {
         auditEnabled: false,
         auditLevel: "ALL",
      };
      state.serverAudit[OTHER_SERVER] = {
         auditEnabled: true,
         auditLevel: "ALL",
      };
      const response = await post(crossServerBody);
      expect(response.status).toBe(201);
      expect(state.audit.mock.calls[0]?.[0].locals.auth).toMatchObject({
         audit: { enabled: true, level: "ALL" },
      });
      expect(state.writeAudits).toHaveBeenCalledWith(
         expect.objectContaining({
            serverId: SOURCE_SERVER,
            audit: { enabled: false, level: "ALL" },
         })
      );
   });
});

describe("both ends are authorized", () => {
   it("hides the source bucket from a member with no grant on it", async () => {
      state.grants[`${SOURCE_SERVER}/from-bucket`] = undefined;
      expect((await post()).status).toBe(404);
      expectNoStorage();
   });

   it("answers the source refusal when both ends refuse", async () => {
      state.grants[`${SOURCE_SERVER}/from-bucket`] = undefined;
      state.grants[`${SOURCE_SERVER}/to-bucket`] = "VIEWER";
      expect((await post()).status).toBe(404);
      expectNoStorage();
   });

   it("refuses a member without upload access on the destination", async () => {
      state.grants[`${SOURCE_SERVER}/to-bucket`] = "VIEWER";
      expect((await post()).status).toBe(403);
      expectNoStorage();
   });

   it("refuses a destination server the member cannot reach", async () => {
      state.members = [SOURCE_SERVER];
      const response = await post({
         destination: {
            serverId: OTHER_SERVER,
            bucketName: "to-bucket",
            objectKey: "imported/q3.csv",
         },
      });
      expect(response.status).toBe(404);
      expectNoStorage();
   });

   it("refuses a stale signed-in account", async () => {
      expect((await post({ expectedUserId: "someoneelse1" })).status).toBe(403);
      expect(state.copy).not.toHaveBeenCalled();
      expect(state.audit).not.toHaveBeenCalled();
   });
});

describe("transfer validation", () => {
   it("copies slash-ending object bodies through the ordinary conditional path", async () => {
      const response = await post({
         source: {
            bucketName: "from-bucket",
            objectKey: "reports/",
            expectedETag: '"reviewed"',
         },
         destination: {
            serverId: SOURCE_SERVER,
            bucketName: "to-bucket",
            objectKey: "imported/reports/",
         },
      });
      expect(response.status).toBe(201);
      expect(state.copy.mock.calls[0]?.[2]).toMatchObject({
         sourceKey: "reports/",
         sourceETag: '"reviewed"',
      });
   });

   it.each([
      [
         "the same object on the same server",
         {
            source: {
               bucketName: "from-bucket",
               objectKey: "reports/q3.csv",
               expectedETag: '"reviewed"',
            },
            destination: {
               serverId: SOURCE_SERVER,
               bucketName: "from-bucket",
               objectKey: "reports/q3.csv",
            },
         },
      ],
      [
         "a wildcard ETag",
         {
            source: {
               bucketName: "from-bucket",
               objectKey: "reports/q3.csv",
               expectedETag: '"*"',
            },
         },
      ],
      ["a missing overwrite choice", { overwrite: undefined }],
   ])("refuses %s", async (_name, overrides) => {
      expect((await post(overrides)).status).toBe(400);
      expectNoStorage();
   });
});
