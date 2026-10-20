import { HeadObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { Permission } from "@s3-viewer/permissions";
import express, { Router } from "express";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode, objectScope } from "@s3-viewer/types";
import { errorHandler } from "@/lib/http";
import { throwHttpError } from "@/lib/s3/errors";
import { isObjectUpload } from "@/lib/middleware/upload-body";
import { withFolderGuard } from "@/lib/s3/folder-guard";
import {
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import type { DbRole } from "@/lib/testing/scope-probe";
import {
   errorXml,
   listing,
   reply,
   s3Fixture,
   xml,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";

const ACTOR = "actor12345";
const SERVER = "server12345";
const BUCKET = "company";

type Grant = { bucketName: string; role: DbRole; folders?: string[] };

const state = vi.hoisted(() => ({
   role: "EDITOR" as "OWNER" | "ADMIN" | "EDITOR" | "VIEWER",
   grants: [] as {
      bucketName: string;
      role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
      folders?: string[];
   }[],
   ticketKeys: [] as string[],
   getClient: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      $queryRaw: scopeQueryRaw(() => ({
         role: state.role,
         grants: state.grants,
      })),
      bucketAccess: {
         findMany: async () =>
            state.grants.map(({ bucketName, role, folders }) => ({
               bucketName,
               role,
               restrictedFolders: folders !== undefined,
               allowedFolders: folders ?? [],
            })),
      },
      archiveTicket: {
         findFirst: async () => ({
            userId: "actor12345",
            serverId: "server12345",
            bucket: "company",
            payload: { objectKeys: state.ticketKeys, sizes: null },
            expiresAt: new Date(Date.now() + 60_000),
         }),
      },
   },
}));
vi.mock("@/lib/s3/client-cache", () => ({ getS3Client: state.getClient }));
vi.mock("@/lib/s3/no-retry", () => ({
   withoutRetries: (client: unknown) => client,
   withoutBudget: (client: unknown) => client,
   forCleanup: (client: unknown) => client,
}));
vi.mock("@/lib/middleware/audit-record", () => ({
   record: async () => undefined,
   recordManyFor: async () => undefined,
   recordMany: async () => undefined,
}));
vi.mock("@/lib/audit/writer", () => ({
   writeAudit: async () => undefined,
   recentlySeen: () => true,
}));

const { s3Router } = await import("./index");
const { transfersRouter } = await import("@/routes/servers/transfers");
const { bucketRoute, foldersCheckedInHandler } = await import(
   "@/lib/middleware/route"
);

// skips its folder check on purpose, so only the storage guard can refuse it.
const uncheckedRouter = Router({ mergeParams: true });
uncheckedRouter.get(
   "/:bucketName/unchecked",
   ...bucketRoute(
      Permission.DOWNLOAD_OBJECT,
      objectScope,
      foldersCheckedInHandler,
      async (_req, res, { bucketName, objectKey }) => {
         const client = (await state.getClient()) as S3Client;
         await client
            .send(new HeadObjectCommand({ Bucket: bucketName, Key: objectKey }))
            .catch(throwHttpError);
         res.json({ reached: true });
      }
   )
);

const notFound = () => xml(errorXml("NoSuchKey"), 404);

let storage: ReturnType<typeof s3Fixture>;
let answer: (request: FixtureRequest) => ReturnType<typeof notFound>;

let origin: string;
routeServer(
   (app) => {
      app.use((req, _res, next) => {
         req.headers["sec-fetch-site"] = "same-origin";
         next();
      });
      app.use(
         signedIn(() => ({
            id: ACTOR,
            email: "contractor@example.com",
            name: "Contractor",
         }))
      );
      const json = express.json({ limit: "1mb" });
      app.use((req, res, next) =>
         isObjectUpload(req) ? next() : json(req, res, next)
      );
      app.use("/servers", transfersRouter);
      app.use("/servers/:serverId/buckets", s3Router);
      app.use("/unchecked/:serverId", uncheckedRouter);
      app.use(errorHandler);
   },
   (listening) => {
      origin = listening;
   }
);
beforeEach(() => {
   state.role = "EDITOR";
   state.grants = [
      { bucketName: BUCKET, role: "EDITOR", folders: ["landing/"] },
   ] satisfies Grant[];
   state.ticketKeys = ["private/secret.txt"];
   answer = notFound;
   storage = s3Fixture(async (request) => answer(request));
   state.getClient.mockReset().mockResolvedValue(storage.client);
});

const objects = `/servers/${SERVER}/buckets/${BUCKET}/objects`;

type Call = {
   route: string;
   method: string;
   path: string;
   query?: Record<string, string>;
   body?: unknown;
   headers?: Record<string, string>;
   // names a key to create, which the schema refuses with dot segments before any folder check.
   creates?: boolean;
};

const send = ({ method, path, query, body, headers }: Call) =>
   fetch(`${origin}${path}${query ? `?${new URLSearchParams(query)}` : ""}`, {
      method,
      headers: {
         ...(body === undefined || typeof body === "string"
            ? {}
            : { "content-type": "application/json" }),
         ...headers,
      },
      body:
         body === undefined
            ? undefined
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
   });

const E_TAG = '"abc"';
const UPLOAD_ID = "upload-1";

const callsWith = (key: string, inside = "landing/ok.png"): Call[] => [
   {
      route: "POST /exists",
      method: "POST",
      path: `${objects}/exists`,
      body: { objectKeys: [inside, key] },
   },
   {
      route: "GET /download-url",
      method: "GET",
      path: `${objects}/download-url`,
      query: { objectKey: key },
   },
   {
      route: "GET /preview-url",
      method: "GET",
      path: `${objects}/preview-url`,
      query: { objectKey: key },
   },
   {
      route: "PUT /v3/upload",
      creates: true,
      method: "PUT",
      path: `${objects}/v3/upload`,
      query: {
         objectKey: key,
         contentType: "text/plain",
         expectedUserId: ACTOR,
      },
      body: "hello",
      headers: { "content-type": "text/plain" },
   },
   {
      route: "DELETE /v3",
      method: "DELETE",
      path: `${objects}/v3`,
      body: {
         expectedUserId: ACTOR,
         objects: [
            { key: inside, expectedETag: null },
            { key, expectedETag: null },
         ],
      },
   },
   {
      route: "GET /keys",
      method: "GET",
      path: `${objects}/keys`,
      query: { prefix: `${key}/` },
   },
   {
      route: "POST /v3/rename",
      method: "POST",
      path: `${objects}/v3/rename`,
      body: {
         objectKey: key,
         newObjectKey: "landing/renamed.png",
         expectedETag: E_TAG,
         expectedUserId: ACTOR,
      },
   },
   {
      route: "POST /v3/rename",
      method: "POST",
      path: `${objects}/v3/rename`,
      body: {
         objectKey: inside,
         newObjectKey: key,
         expectedETag: E_TAG,
         expectedUserId: ACTOR,
      },
      creates: true,
   },
   {
      route: "POST /v3/move",
      method: "POST",
      path: `${objects}/v3/move`,
      body: {
         expectedUserId: ACTOR,
         objects: [{ key, newKey: "landing/moved.png", expectedETag: null }],
      },
   },
   {
      route: "POST /v3/move",
      method: "POST",
      path: `${objects}/v3/move`,
      body: {
         expectedUserId: ACTOR,
         objects: [{ key: inside, newKey: key, expectedETag: null }],
      },
      creates: true,
   },
   {
      route: "POST /v3/copy",
      method: "POST",
      path: `${objects}/v3/copy`,
      body: {
         objectKey: key,
         newObjectKey: "landing/copied.png",
         expectedETag: E_TAG,
         expectedUserId: ACTOR,
      },
   },
   {
      route: "POST /v3/copy",
      method: "POST",
      path: `${objects}/v3/copy`,
      body: {
         objectKey: inside,
         newObjectKey: key,
         expectedETag: E_TAG,
         expectedUserId: ACTOR,
      },
      creates: true,
   },
   {
      route: "POST /v3/folders",
      method: "POST",
      path: `${objects}/v3/folders`,
      body: { folderKey: `${key}/`, expectedUserId: ACTOR },
      creates: true,
   },
   {
      route: "GET /v3/content",
      method: "GET",
      path: `${objects}/v3/content`,
      query: { objectKey: key },
   },
   {
      route: "GET /v3/settings",
      method: "GET",
      path: `${objects}/v3/settings`,
      query: { objectKey: key },
   },
   {
      route: "PATCH /v3/settings",
      method: "PATCH",
      path: `${objects}/v3/settings`,
      body: {
         objectKey: key,
         expectedUserId: ACTOR,
         expectedETag: E_TAG,
         contentType: "text/plain",
         metadata: {},
      },
   },
   {
      route: "POST /v3/archive",
      method: "POST",
      path: `${objects}/v3/archive`,
      body: { expectedUserId: ACTOR, objectKeys: [inside, key] },
   },
   {
      route: "POST /v3/archive",
      method: "POST",
      path: `${objects}/v3/archive`,
      body: { expectedUserId: ACTOR, objectKeys: [`${key}/`] },
   },
   {
      route: "DELETE /v3/multipart-uploads",
      method: "DELETE",
      path: `${objects}/v3/multipart-uploads`,
      body: { expectedUserId: ACTOR, uploads: [{ key, uploadId: UPLOAD_ID }] },
   },
   {
      route: "POST /v3/multipart-uploads",
      creates: true,
      method: "POST",
      path: `${objects}/v3/multipart-uploads`,
      body: {
         objectKey: key,
         expectedUserId: ACTOR,
         contentType: "text/plain",
         totalBytes: 100,
      },
   },
   {
      route: "PUT /v3/multipart-uploads/parts",
      method: "PUT",
      path: `${objects}/v3/multipart-uploads/parts`,
      query: {
         objectKey: key,
         expectedUserId: ACTOR,
         uploadId: UPLOAD_ID,
         partNumber: "1",
      },
      body: "part",
      headers: { "content-type": "application/octet-stream" },
   },
   {
      route: "GET /v3/multipart-uploads/parts",
      method: "GET",
      path: `${objects}/v3/multipart-uploads/parts`,
      query: { objectKey: key, uploadId: UPLOAD_ID },
   },
   {
      route: "POST /v3/multipart-uploads/complete",
      method: "POST",
      path: `${objects}/v3/multipart-uploads/complete`,
      body: {
         objectKey: key,
         expectedUserId: ACTOR,
         uploadId: UPLOAD_ID,
         parts: [{ partNumber: 1, eTag: "etag" }],
      },
   },
   {
      route: "DELETE /v3/multipart-uploads/upload",
      method: "DELETE",
      path: `${objects}/v3/multipart-uploads/upload`,
      body: { objectKey: key, expectedUserId: ACTOR, uploadId: UPLOAD_ID },
   },
];

const SHAPED_ROUTES = [
   "GET /",
   "GET /v3/multipart-uploads",
   "HEAD /v3/archive/:token",
   "GET /v3/archive/:token",
];
type Layer = {
   route?: { path: string | string[]; methods: Record<string, boolean> };
   handle?: { stack?: Layer[] };
};

const objectRoutes = (router: Router): string[] =>
   (router.stack as unknown as Layer[]).flatMap((layer) => {
      if (layer.handle?.stack && !layer.route)
         return objectRoutes(layer.handle as unknown as Router);
      if (!layer.route) return [];
      const { path, methods } = layer.route;
      return [path].flat().flatMap((each) =>
         Object.keys(methods)
            // route.all registers an _all marker, not a verb; HEAD is listed only where declared (archive), though Express also answers it from GET routes.
            .filter((method) => method !== "_all")
            .map((method) => `${method.toUpperCase()} ${each}`)
      );
   });

const expectRefused = async (call: Call) => {
   const response = await send(call);
   const body =
      call.method === "HEAD" ? null : ((await response.json()) as unknown);
   expect({ status: response.status, body }).toMatchObject({
      status: 403,
      ...(body ? { body: { code: ErrorCode.FOLDER_ACCESS } } : {}),
   });
   expect(storage.requests).toEqual([]);
};

const expectDotSegmentsRefused = async (call: Call) => {
   const response = await send(call);
   await expect(
      response.json().then((body) => ({ status: response.status, body }))
   ).resolves.toMatchObject(
      call.creates
         ? { status: 400, body: { code: ErrorCode.VALIDATION } }
         : { status: 403, body: { code: ErrorCode.FOLDER_ACCESS } }
   );
   expect(storage.requests).toEqual([]);
};

describe("every object route is covered", () => {
   it("has a refusal case for each route that names a key", () => {
      const BUCKET_ROUTES = ["GET /", "POST /", "DELETE /:bucketName"];
      const declared = new Set(objectRoutes(s3Router));
      const covered = new Set([
         ...callsWith("x").map(({ route }) => route),
         ...SHAPED_ROUTES,
         ...BUCKET_ROUTES,
      ]);
      expect([...declared].filter((route) => !covered.has(route))).toEqual([]);
   });
});

describe("a member limited to landing/", () => {
   it.each(callsWith("private/secret.txt"))(
      "is refused $route on a key outside their folder before storage is asked",
      expectRefused
   );

   it.each(callsWith("landing-internal/plan.pdf"))(
      "is refused $route on a sibling that only shares the folder's name",
      expectRefused
   );

   it.each(
      // these rows turn "landing" into "landing/", which is the folder itself.
      callsWith("landing").filter(
         (call) => !JSON.stringify(call).includes('"landing/"')
      )
   )("is refused $route on the folder's name without its slash", expectRefused);

   it("is refused removing the bucket even if a limited grant were an admin one", async () => {
      // the database forbids this row; the route must not depend on that.
      state.role = "ADMIN";
      state.grants = [
         { bucketName: BUCKET, role: "ADMIN", folders: ["landing/"] },
      ];
      await expectRefused({
         route: "DELETE /:bucketName",
         method: "DELETE",
         path: `/servers/${SERVER}/buckets/${BUCKET}`,
      });
   });

   it.each(["HEAD", "GET"])(
      "is refused %s on a zip ticket naming keys outside their folder",
      async (method) => {
         const token = "t".repeat(43);
         const response = await send({
            route: `${method} /v3/archive/:token`,
            method,
            path: `${objects}/v3/archive/${token}`,
         });
         expect(response.status).toBe(403);
         expect(storage.requests).toEqual([]);
      }
   );

   it("sees only the way to their folder when listing above it", async () => {
      const list = async (prefix: string) =>
         (
            await send({
               route: "GET /",
               method: "GET",
               path: objects,
               query: { prefix, blockSize: "50" },
            })
         ).json();
      await expect(list("")).resolves.toEqual({
         objects: [
            {
               key: "landing/",
               isFolder: true,
               eTag: null,
               lastModified: null,
               size: null,
            },
         ],
         nextToken: null,
      });
      await expect(list("land")).resolves.toMatchObject({
         objects: [{ key: "landing/" }],
      });
      await expect(list("private/")).resolves.toEqual({
         objects: [],
         nextToken: null,
      });
      await expect(list("landing-internal/")).resolves.toEqual({
         objects: [],
         nextToken: null,
      });
      expect(storage.requests).toEqual([]);
   });

   it("lists inside their folder from storage, under that prefix only", async () => {
      answer = () => listing([{ key: "landing/hero.png", size: 3 }]);
      const response = await send({
         route: "GET /",
         method: "GET",
         path: objects,
         query: { prefix: "landing/", blockSize: "50" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
         objects: [{ key: "landing/hero.png" }],
      });
      expect(storage.requests.map(({ query }) => query.prefix)).toEqual([
         "landing/",
      ]);
   });

   it("reaches storage for a key inside their folder", async () => {
      const response = await send({
         route: "GET /v3/settings",
         method: "GET",
         path: `${objects}/v3/settings`,
         query: { objectKey: "landing/hero.png" },
      });
      expect(response.status).toBe(404);
      expect(storage.requests.map(({ path }) => path)).toEqual([
         `/${BUCKET}/landing/hero.png`,
      ]);
   });

   it("lists incomplete uploads only within their folder", async () => {
      answer = () =>
         reply(
            200,
            Readable.from([
               `<?xml version="1.0" encoding="UTF-8"?><ListMultipartUploadsResult><IsTruncated>false</IsTruncated>` +
                  ["landing/a.bin", "private/b.bin", "landing-internal/c.bin"]
                     .map(
                        (key) =>
                           `<Upload><Key>${key}</Key><UploadId>u-${key}</UploadId></Upload>`
                     )
                     .join("") +
                  `</ListMultipartUploadsResult>`,
            ])
         );
      const response = await send({
         route: "GET /v3/multipart-uploads",
         method: "GET",
         path: `${objects}/v3/multipart-uploads`,
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
         uploads: [{ key: "landing/a.bin" }],
         nextKeyMarker: null,
      });
   });

   it("checks existence per folder so no listing spans the bucket", async () => {
      state.grants = [
         { bucketName: BUCKET, role: "EDITOR", folders: ["a/", "z/"] },
      ];
      answer = () => listing([]);
      const keys = [
         ...Array.from({ length: 60 }, (_, i) => `a/${i}.txt`),
         ...Array.from({ length: 60 }, (_, i) => `z/${i}.txt`),
      ];
      const response = await send({
         route: "POST /exists",
         method: "POST",
         path: `${objects}/exists`,
         body: { objectKeys: keys },
      });
      expect(response.status).toBe(200);
      const prefixes = storage.requests.map(({ query }) => query.prefix ?? "");
      expect(prefixes.length).toBeGreaterThan(0);
      for (const prefix of prefixes)
         expect(prefix.startsWith("a/") || prefix.startsWith("z/")).toBe(true);
   });
});

const transfer = (source: string, destination: string): Call => ({
   route: "POST /transfers",
   method: "POST",
   path: `/servers/${SERVER}/transfers`,
   body: {
      expectedUserId: ACTOR,
      source: { bucketName: BUCKET, objectKey: source, expectedETag: null },
      destination: {
         serverId: SERVER,
         bucketName: "archive",
         objectKey: destination,
      },
      overwrite: false,
   },
});

const TRANSFER_GRANTS: Grant[] = [
   { bucketName: BUCKET, role: "EDITOR", folders: ["landing/"] },
   { bucketName: "archive", role: "EDITOR", folders: ["inbox/"] },
];

describe("the storage guard behind a route that forgot its check", () => {
   beforeEach(() => {
      withFolderGuard(storage.client, SERVER);
   });

   const unchecked = (objectKey: string) =>
      fetch(
         `${origin}/unchecked/${SERVER}/${BUCKET}/unchecked?${new URLSearchParams({ objectKey })}`
      );

   it("still stops a key outside the caller's folders", async () => {
      const response = await unchecked("private/secret.txt");
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
         code: ErrorCode.FOLDER_ACCESS,
      });
      expect(storage.requests).toEqual([]);
   });

   it("lets a key inside them through", async () => {
      await unchecked("landing/hero.png");
      expect(storage.requests.map(({ path }) => path)).toEqual([
         `/${BUCKET}/landing/hero.png`,
      ]);
   });

   it("stops dot segments for a whole-bucket member but not for the owner", async () => {
      state.grants = [{ bucketName: BUCKET, role: "EDITOR" }];
      expect((await unchecked("../other-bucket/secret.txt")).status).toBe(403);
      expect(storage.requests).toEqual([]);
      state.role = "OWNER";
      await unchecked("odd/../key.txt");
      expect(storage.requests).toHaveLength(1);
   });
});

describe("dot segments", () => {
   describe.each([
      {
         who: "a member limited to landing/",
         folders: ["landing/"],
         key: "landing/../private/secret.txt",
      },
      {
         who: "a whole-bucket member",
         folders: undefined,
         key: "landing/../../other-bucket/x",
      },
   ])("for $who", ({ folders, key }) => {
      it.each(callsWith(key))("keep $route from storage", async (call) => {
         state.grants = [{ bucketName: BUCKET, role: "EDITOR", folders }];
         await expectDotSegmentsRefused(call);
      });
   });

   const DOT_MESSAGE =
      "Paths with . or .. segments can only be opened by the server owner.";
   const read = (objectKey: string): Call => ({
      route: "GET /v3/settings",
      method: "GET",
      path: `${objects}/v3/settings`,
      query: { objectKey },
   });
   const list = (prefix: string): Call => ({
      route: "GET /",
      method: "GET",
      path: objects,
      query: { prefix, blockSize: "50" },
   });

   it.each([
      ["a folder-limited member", ["landing/"]],
      ["a whole-bucket member", undefined],
   ])(
      "keep %s from climbing into another folder or bucket",
      async (_who, folders) => {
         state.grants = [{ bucketName: BUCKET, role: "EDITOR", folders }];
         for (const call of [
            read("landing/../../other-bucket/secret.txt"),
            read("landing/./hero.png"),
            read("landing/a\\..\\..\\x"),
            list("landing/../"),
            list("landing/.."),
            list("landing/..\\..\\private\\"),
            {
               route: "GET /v3/multipart-uploads",
               method: "GET",
               path: `${objects}/v3/multipart-uploads`,
               query: { prefix: "landing/../" },
            },
            transfer("landing/../x", "inbox/x"),
         ]) {
            if (call.route === "POST /transfers")
               state.grants = [
                  { bucketName: BUCKET, role: "EDITOR", folders },
                  { bucketName: "archive", role: "EDITOR" },
               ];
            const response = await send(call);
            expect(response.status).toBe(403);
            await expect(response.json()).resolves.toMatchObject({
               message: DOT_MESSAGE,
            });
         }
         expect(storage.requests).toEqual([]);
      }
   );

   it("still lets a member search for dotfiles while typing", async () => {
      answer = () => listing([{ key: "landing/.env", size: 1 }]);
      const response = await send(list("landing/."));
      expect(response.status).toBe(200);
      expect(storage.requests.map(({ query }) => query.prefix)).toEqual([
         "landing/.",
      ]);
   });

   it("leaves the owner able to reach keys that already have them", async () => {
      state.role = "OWNER";
      state.grants = [];
      expect((await send(read("odd/../key.txt"))).status).toBe(404);
      expect(storage.requests).toHaveLength(1);
   });
});

describe("bulk checks and zips around odd names", () => {
   it("checks many keys that share a leading '..' without tripping the guard", async () => {
      answer = () => listing([]);
      const response = await send({
         route: "POST /exists",
         method: "POST",
         path: `${objects}/exists`,
         body: {
            objectKeys: [
               ...Array.from({ length: 30 }, (_, i) => `landing/..a${i}`),
               ...Array.from({ length: 30 }, (_, i) => `landing/..b${i}`),
            ],
         },
      });
      expect(response.status).toBe(200);
      expect(
         new Set(storage.requests.map(({ query }) => query.prefix))
      ).toEqual(new Set(["landing/"]));
   });

   it("refuses a zip up front when the folder holds a path only the owner may open", async () => {
      answer = () =>
         listing([
            { key: "landing/ok.png", size: 1 },
            { key: "landing/a/../b.png", size: 1 },
         ]);
      const zip: Call = {
         route: "POST /v3/archive",
         method: "POST",
         path: `${objects}/v3/archive`,
         body: { expectedUserId: ACTOR, objectKeys: ["landing/"] },
      };
      const response = await send(zip);
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
         message: expect.stringContaining("landing/a/../b.png"),
      });
   });
});

describe("what a refusal says", () => {
   const refusal = async (folders: string[], objectKey: string) => {
      state.grants = [{ bucketName: BUCKET, role: "EDITOR", folders }];
      const response = await send({
         route: "GET /v3/settings",
         method: "GET",
         path: `${objects}/v3/settings`,
         query: { objectKey },
      });
      return ((await response.json()) as { message: string }).message;
   };

   it("names the one folder, or the first few of many", async () => {
      await expect(refusal(["landing/"], "private/x")).resolves.toBe(
         "Your access to this bucket is limited to landing/"
      );
      await expect(
         refusal(["a/", "b/", "c/", "d/", "e/"], "private/x")
      ).resolves.toBe(
         "Your access to this bucket is limited to these folders: a/, b/, c/ and 2 more"
      );
   });
});

describe("the bucket list", () => {
   it("tells a member which folders they hold in each bucket", async () => {
      state.grants = [
         { bucketName: BUCKET, role: "EDITOR", folders: ["landing/"] },
         { bucketName: "open", role: "VIEWER" },
      ];
      const response = await fetch(`${origin}/servers/${SERVER}/buckets`);
      await expect(response.json()).resolves.toEqual({
         buckets: [
            {
               name: BUCKET,
               creationDate: null,
               userRole: "EDITOR",
               folders: ["landing/"],
            },
            {
               name: "open",
               creationDate: null,
               userRole: "VIEWER",
               folders: null,
            },
         ],
      });
   });
});

describe("transfers", () => {
   beforeEach(() => {
      state.grants = TRANSFER_GRANTS;
   });

   it("refuses copying a key from outside the source folder", async () => {
      await expectRefused(transfer("private/secret.txt", "inbox/secret.txt"));
   });

   it("refuses writing outside the destination folder", async () => {
      await expectRefused(transfer("landing/hero.png", "elsewhere/hero.png"));
   });

   it("lets a transfer between two held folders reach storage", async () => {
      const response = await send(
         transfer("landing/hero.png", "inbox/hero.png")
      );
      expect(response.status).toBe(404);
      expect(storage.requests.map(({ path }) => path)).toEqual([
         `/${BUCKET}/landing/hero.png`,
      ]);
   });
});

describe("whole-bucket access is unchanged", () => {
   it.each([
      ["an owner", "OWNER" as const, []],
      [
         "a member with a whole-bucket grant",
         "EDITOR" as const,
         [{ bucketName: BUCKET, role: "EDITOR" as const }],
      ],
   ])("lets %s reach any key and list the root", async (_who, role, grants) => {
      state.role = role;
      state.grants = grants;
      const settings = await send({
         route: "GET /v3/settings",
         method: "GET",
         path: `${objects}/v3/settings`,
         query: { objectKey: "private/secret.txt" },
      });
      expect(settings.status).toBe(404);
      answer = () => listing([{ key: "anything.txt", size: 1 }]);
      const listed = await send({
         route: "GET /",
         method: "GET",
         path: objects,
         query: { blockSize: "50" },
      });
      await expect(listed.json()).resolves.toMatchObject({
         objects: [{ key: "anything.txt" }],
      });
   });
});

describe("a grant that fails to say whether it is limited", () => {
   it("is treated as reaching no folders", async () => {
      state.grants = [{ bucketName: BUCKET, role: "EDITOR", folders: [] }];
      await expectRefused({
         route: "GET /v3/settings",
         method: "GET",
         path: `${objects}/v3/settings`,
         query: { objectKey: "landing/hero.png" },
      });
   });
});
