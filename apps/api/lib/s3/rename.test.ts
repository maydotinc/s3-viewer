import { S3Client, type Grant } from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { renameObject } from "./rename";

type Request = {
   method: string;
   path: string;
   query: Record<string, string>;
   headers: Record<string, string>;
   body: unknown;
};
type StoredObject = { data: string; headers: Record<string, string> };
const owner = "a".repeat(64);
const xml = (value: string) =>
   value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
const grants: Grant[] = [
   {
      Grantee: { Type: "CanonicalUser", ID: owner },
      Permission: "FULL_CONTROL",
   },
];
const response = (
   body = "",
   statusCode = 200,
   headers: Record<string, string> = {}
) => ({
   response: {
      statusCode,
      headers: { "content-type": "application/xml", ...headers },
      body: Readable.from([body]),
   },
});
const failure = (code: string, statusCode: number) =>
   response(
      `<Error><Code>${code}</Code><Message>${code}</Message></Error>`,
      statusCode
   );

const fixture = (
   options: {
      provider?: Provider;
      ownership?: string;
      ownershipError?: boolean;
      aclError?: boolean;
      aclCopyError?: { code: string; status: number };
      taggingError?: { code: string; status: number };
      missingTagSet?: boolean;
      grants?: Grant[];
      sourceHeaders?: Record<string, string | undefined>;
      beforeCommit?: (objects: Map<string, StoredObject>) => void;
      beforeSelection?: (objects: Map<string, StoredObject>) => void;
      afterCommit?: (objects: Map<string, StoredObject>) => void;
      afterDelete?: (objects: Map<string, StoredObject>) => void;
      deleteError?: boolean;
      copyError?: boolean;
      timeoutAfterCopy?: boolean;
      timeoutAfterDelete?: "absent" | "replacement";
      changedAcl?: boolean;
      changedTags?: boolean;
      partMissingETag?: boolean;
   } = {}
) => {
   const provider = options.provider ?? Provider.S3;
   const headers: Record<string, string> = {
      etag: '"original"',
      "content-length": "8",
      "content-type": "text/plain",
      "x-amz-meta-color": "blue",
      "cache-control": "max-age=60",
   };
   for (const [key, value] of Object.entries(options.sourceHeaders ?? {})) {
      if (value === undefined) delete headers[key];
      else headers[key] = value;
   }
   const objects = new Map<string, StoredObject>([
      [
         "old.txt",
         { data: headers["content-length"] === "0" ? "" : "original", headers },
      ],
   ]);
   const requests: Request[] = [];
   let initiated: Record<string, string> = {};
   let part: StoredObject | undefined;
   let committed = false;
   const copyHeaders = (request: Request) =>
      Object.fromEntries(
         Object.entries(request.headers).filter(
            ([key]) =>
               key.startsWith("x-amz-meta-") ||
               [
                  "content-type",
                  "cache-control",
                  "content-disposition",
                  "content-encoding",
                  "content-language",
                  "expires",
                  "x-amz-website-redirect-location",
                  "x-amz-storage-class",
                  "x-amz-server-side-encryption",
                  "x-amz-server-side-encryption-aws-kms-key-id",
                  "x-amz-server-side-encryption-bucket-key-enabled",
               ].includes(key)
         )
      );
   const commit = (
      request: Request,
      source: StoredObject,
      multipart = false
   ) => {
      options.beforeCommit?.(objects);
      if (
         objects.has("new.txt") &&
         (request.headers["if-none-match"] === "*" ||
            request.headers["cf-copy-destination-if-none-match"] === "*")
      )
         return failure("PreconditionFailed", 412);
      if (options.copyError) return failure("SlowDown", 503);
      const metadata = multipart
         ? initiated
         : request.headers["x-amz-copy-source"]
           ? { ...source.headers, ...copyHeaders(request) }
           : copyHeaders(request);
      const etag = multipart ? '"multipart-result-1"' : '"copied-result"';
      objects.set("new.txt", {
         data: source.data,
         headers: {
            ...metadata,
            "content-length": String(source.data.length),
            etag,
         },
      });
      committed = true;
      options.afterCommit?.(objects);
      if (options.timeoutAfterCopy)
         throw Object.assign(new Error("response lost"), {
            name: "TimeoutError",
         });
      return request.method === "PUT" && !request.headers["x-amz-copy-source"]
         ? response("", 200, { etag })
         : response(
              `<${multipart ? "CompleteMultipartUploadResult" : "CopyObjectResult"}><ETag>${xml(etag)}</ETag></${multipart ? "CompleteMultipartUploadResult" : "CopyObjectResult"}>`
           );
   };
   const handle = vi.fn(async (request: Request) => {
      requests.push(request);
      const key = decodeURIComponent(request.path.split("/").at(-1) ?? "");
      if (request.method === "HEAD") {
         const object = objects.get(key);
         return object
            ? response("", 200, object.headers)
            : failure("NotFound", 404);
      }
      if ("ownershipControls" in request.query) {
         if (options.ownershipError) return failure("AccessDenied", 403);
         return response(
            `<OwnershipControls><Rule><ObjectOwnership>${options.ownership ?? "BucketOwnerEnforced"}</ObjectOwnership></Rule></OwnershipControls>`
         );
      }
      if ("acl" in request.query) {
         if (options.aclError) return failure("AccessDenied", 403);
         const activeGrants =
            options.changedAcl && committed
               ? grants
               : (options.grants ?? grants);
         return response(
            `<AccessControlPolicy><Owner><ID>${owner}</ID></Owner><AccessControlList>${activeGrants.map(({ Grantee: grantee, Permission: permission }) => `<Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="${grantee?.Type}">${grantee?.ID ? `<ID>${xml(grantee.ID)}</ID>` : ""}${grantee?.URI ? `<URI>${xml(grantee.URI)}</URI>` : ""}</Grantee><Permission>${permission}</Permission></Grant>`).join("")}</AccessControlList></AccessControlPolicy>`
         );
      }
      if ("tagging" in request.query) {
         if (options.taggingError)
            return failure(
               options.taggingError.code,
               options.taggingError.status
            );
         if (options.missingTagSet) return response("<Tagging/>");
         return response(
            `<Tagging><TagSet><Tag><Key>team name</Key><Value>${options.changedTags && committed ? "changed" : "A&amp;B"}</Value></Tag></TagSet></Tagging>`
         );
      }
      if (request.method === "POST" && "uploads" in request.query) {
         initiated = copyHeaders(request);
         return response(
            "<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>"
         );
      }
      if (request.method === "PUT" && "uploadId" in request.query) {
         options.beforeSelection?.(objects);
         const source = objects.get("old.txt")!;
         if (
            request.headers["x-amz-copy-source-if-match"] !==
            source.headers.etag
         )
            return failure("PreconditionFailed", 412);
         part = structuredClone(source);
         return response(
            `<CopyPartResult>${options.partMissingETag ? "" : '<ETag>"part"</ETag>'}</CopyPartResult>`
         );
      }
      if (request.method === "POST" && "uploadId" in request.query)
         return commit(request, part!, true);
      if (request.method === "DELETE" && "uploadId" in request.query)
         return response("", 204);
      if (request.method === "PUT") {
         if (
            options.aclCopyError &&
            request.headers["x-amz-grant-full-control"]
         )
            return failure(
               options.aclCopyError.code,
               options.aclCopyError.status
            );
         options.beforeSelection?.(objects);
         const source = objects.get("old.txt")!;
         if (
            request.headers["x-amz-copy-source"] &&
            request.headers["x-amz-copy-source-if-match"] !==
               source.headers.etag
         )
            return failure("PreconditionFailed", 412);
         return commit(request, structuredClone(source));
      }
      if (request.method === "DELETE") {
         if (
            request.headers["if-match"] &&
            request.headers["if-match"] !== objects.get(key)?.headers.etag
         )
            return failure("PreconditionFailed", 412);
         if (options.deleteError) return failure("AccessDenied", 403);
         const original = objects.get(key)!;
         objects.delete(key);
         options.afterDelete?.(objects);
         if (options.timeoutAfterDelete === "replacement")
            objects.set(key, {
               data: original.data,
               headers: {
                  ...original.headers,
                  "x-amz-meta-color": "replacement",
               },
            });
         if (options.timeoutAfterDelete)
            throw Object.assign(new Error("response lost"), {
               name: "TimeoutError",
            });
         return response("", 204);
      }
      throw new Error(`Unexpected request ${request.method} ${request.path}`);
   });
   const client = new S3Client({
      endpoint:
         provider === Provider.S3
            ? "https://s3.us-east-1.amazonaws.com"
            : provider === Provider.R2
              ? "https://abc.r2.cloudflarestorage.com"
              : "https://minio.example",
      region: "us-east-1",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      forcePathStyle: true,
      maxAttempts: 3,
      requestHandler: { handle },
   });
   const run = () =>
      renameObject({ client, bucket: "bucket" }, "old.txt", "new.txt");
   const writes = () =>
      requests.filter((r) => r.method === "PUT" || r.method === "POST");
   const deletes = () =>
      requests.filter((r) => r.method === "DELETE" && !("uploadId" in r.query));
   return { objects, requests, run, writes, deletes, client };
};

describe("provider-compatible rename", () => {
   it.each([Provider.S3, Provider.R2, Provider.Other])(
      "renames an unversioned object on %s",
      async (provider) => {
         const f = fixture({ provider });
         await f.run();
         expect([...f.objects.keys()]).toEqual(["new.txt"]);
         expect(f.objects.get("new.txt")?.data).toBe("original");
         expect(f.requests.some((r) => "versioning" in r.query)).toBe(false);
         expect(f.deletes()).toHaveLength(1);
         expect(f.deletes()[0]?.query).not.toHaveProperty("versionId");
         expect(f.deletes()[0]?.headers["if-match"]).toBe(
            provider === Provider.S3 ? '"original"' : undefined
         );
         expect(await f.client.config.maxAttempts()).toBe(3);
      }
   );
   it("uses the signed R2 destination extension without unsupported AWS headers", async () => {
      const f = fixture({
         provider: Provider.R2,
         sourceHeaders: { "x-amz-server-side-encryption": "AES256" },
      });
      await f.run();
      const copy = f.writes()[0]!;
      expect(copy.headers["cf-copy-destination-if-none-match"]).toBe("*");
      expect(copy.headers.authorization).toContain(
         "cf-copy-destination-if-none-match"
      );
      expect(copy.headers).not.toHaveProperty("if-none-match");
      expect(copy.headers).not.toHaveProperty("x-amz-server-side-encryption");
      expect(copy.headers["x-amz-metadata-directive"]).toBe("COPY");
      expect(
         f.requests.some(
            (r) => "ownershipControls" in r.query || "acl" in r.query
         )
      ).toBe(false);
   });
   it("uses conditional multipart publish on MinIO and preserves metadata and encoded tags", async () => {
      const f = fixture({
         provider: Provider.Other,
         sourceHeaders: {
            "x-amz-website-redirect-location": "/landing",
            "content-disposition": "attachment",
         },
      });
      await f.run();
      expect(f.writes()).toHaveLength(3);
      const [create, part, complete] = f.writes();
      expect(create?.headers).toMatchObject({
         "x-amz-meta-color": "blue",
         "x-amz-tagging": "team+name=A%26B",
         "x-amz-website-redirect-location": "/landing",
         "content-disposition": "attachment",
      });
      expect(part?.headers["x-amz-copy-source-if-match"]).toBe('"original"');
      expect(complete?.headers["if-none-match"]).toBe("*");
   });
   it("copies an empty MinIO object with a conditional empty put", async () => {
      const f = fixture({
         provider: Provider.Other,
         sourceHeaders: { "content-length": "0" },
      });
      await f.run();
      expect(f.writes()).toHaveLength(1);
      expect(f.writes()[0]?.headers["if-none-match"]).toBe("*");
      expect(f.objects.get("new.txt")?.data).toBe("");
   });
   it.each(["null", "version/+="])(
      "pins a returned source version %s without requiring versioning",
      async (version) => {
         const f = fixture({ sourceHeaders: { "x-amz-version-id": version } });
         await f.run();
         expect(f.writes()[0]?.headers["x-amz-copy-source"]).toBe(
            `bucket/old.txt?versionId=${encodeURIComponent(version)}`
         );
      }
   );
   it("preserves AWS redirect, encryption, storage class and lock attributes in the copy", async () => {
      const f = fixture({
         sourceHeaders: {
            "x-amz-website-redirect-location": "/landing",
            "x-amz-storage-class": "STANDARD_IA",
            "x-amz-server-side-encryption": "aws:kms",
            "x-amz-server-side-encryption-aws-kms-key-id": "key-id",
            "x-amz-server-side-encryption-bucket-key-enabled": "false",
            "x-amz-object-lock-legal-hold": "ON",
         },
      });
      await f.run();
      expect(f.writes()[0]?.headers).toMatchObject({
         "x-amz-website-redirect-location": "/landing",
         "x-amz-storage-class": "STANDARD_IA",
         "x-amz-server-side-encryption": "aws:kms",
         "x-amz-server-side-encryption-aws-kms-key-id": "key-id",
         "x-amz-server-side-encryption-bucket-key-enabled": "false",
         "x-amz-object-lock-legal-hold": "ON",
      });
   });
   it.each(["ObjectWriter", "BucketOwnerPreferred"])(
      "preserves ACL grants for %s",
      async (ownership) => {
         const f = fixture({
            ownership,
            grants: [
               ...grants,
               {
                  Grantee: {
                     Type: "Group",
                     URI: "http://acs.amazonaws.com/groups/global/AllUsers",
                  },
                  Permission: "READ",
               },
            ],
         });
         await f.run();
         expect(f.writes()[0]?.headers).toMatchObject({
            "x-amz-grant-full-control": `id="${owner}"`,
            "x-amz-grant-read":
               'uri="http://acs.amazonaws.com/groups/global/AllUsers"',
         });
      }
   );
   it("preserves a readable source ACL when ownership controls are denied", async () => {
      const f = fixture({ ownershipError: true });
      await f.run();
      expect(f.writes()[0]?.headers["x-amz-grant-full-control"]).toBe(
         `id="${owner}"`
      );
   });
   it("supports disabled ACLs without requiring bucket ownership read permission", async () => {
      const f = fixture({
         ownershipError: true,
         aclCopyError: { code: "AccessControlListNotSupported", status: 400 },
      });
      await f.run();
      expect(f.writes()).toHaveLength(2);
      const [rejected, accepted] = f.writes();
      expect(rejected?.headers["x-amz-grant-full-control"]).toBe(
         `id="${owner}"`
      );
      expect(accepted?.headers).not.toHaveProperty("x-amz-grant-full-control");
      expect(accepted?.headers).toMatchObject({
         "if-none-match": "*",
         "x-amz-copy-source-if-match": '"original"',
         "x-amz-metadata-directive": "COPY",
         "x-amz-copy-source": "bucket/old.txt",
      });
      expect(f.objects.has("old.txt")).toBe(false);
   });
   it.each([
      { code: "AccessDenied", status: 403 },
      { code: "AccessControlListNotSupported", status: 503 },
      { code: "InvalidRequest", status: 400 },
   ])(
      "does not discard ACLs for a different copy error: $code/$status",
      async (aclCopyError) => {
         const f = fixture({ ownership: "ObjectWriter", aclCopyError });
         await expect(f.run()).rejects.toBeDefined();
         expect(f.writes()).toHaveLength(1);
         expect(f.objects.has("new.txt")).toBe(false);
      }
   );
   it("does not retry an ambiguous copy when preserving source ACLs", async () => {
      const f = fixture({ ownership: "ObjectWriter", timeoutAfterCopy: true });
      await expect(f.run()).rejects.toMatchObject({ status: 502 });
      expect(f.writes()).toHaveLength(1);
      expect(f.deletes()).toHaveLength(0);
   });
   it("surfaces a real ACL permission error before copying", async () => {
      const f = fixture({ ownership: "ObjectWriter", aclError: true });
      await expect(f.run()).rejects.toMatchObject({ status: 403 });
      expect(f.writes()).toHaveLength(0);
   });
   it("does not silently discard unsupported source grants", async () => {
      const f = fixture({
         ownership: "ObjectWriter",
         grants: [
            {
               Grantee: { Type: "CanonicalUser", ID: owner },
               Permission: "WRITE",
            },
         ],
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.writes()).toHaveLength(0);
   });
   it("retains the source when its ACL changes during the copy", async () => {
      const f = fixture({
         ownership: "ObjectWriter",
         changedAcl: true,
         grants: [
            ...grants,
            {
               Grantee: { Type: "CanonicalUser", ID: "b".repeat(64) },
               Permission: "READ",
            },
         ],
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.deletes()).toHaveLength(0);
   });
   it.each([Provider.S3, Provider.R2, Provider.Other])(
      "does not overwrite a concurrent destination on %s",
      async (provider) => {
         const f = fixture({
            provider,
            beforeCommit: (objects) =>
               objects.set("new.txt", { data: "another file", headers: {} }),
         });
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.objects.get("new.txt")?.data).toBe("another file");
         expect(f.objects.has("old.txt")).toBe(true);
         expect(f.deletes()).toHaveLength(0);
      }
   );
   it.each(["old.txt", "new.txt"])(
      "retains both keys if %s changes after the copy",
      async (key) => {
         const f = fixture({
            afterCommit: (objects) => {
               objects.get(key)!.headers["x-amz-meta-color"] = "updated";
            },
         });
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.deletes()).toHaveLength(0);
         expect(f.objects.size).toBe(2);
      }
   );
   it("preserves the original if MinIO tags change after the copy", async () => {
      const f = fixture({ provider: Provider.Other, changedTags: true });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.deletes()).toHaveLength(0);
   });
   it.each([Provider.S3, Provider.R2, Provider.Other])(
      "does not retry an ambiguous copy on %s",
      async (provider) => {
         const f = fixture({ provider, timeoutAfterCopy: true });
         await expect(f.run()).rejects.toMatchObject({ status: 502 });
         expect(f.writes()).toHaveLength(provider === Provider.Other ? 3 : 1);
         expect(f.objects.size).toBe(2);
         expect(f.deletes()).toHaveLength(0);
      }
   );
   it("does not retry a transient copy rejection", async () => {
      const f = fixture({ copyError: true });
      await expect(f.run()).rejects.toMatchObject({ status: 502 });
      expect(f.writes()).toHaveLength(1);
   });
   it.each([Provider.S3, Provider.R2, Provider.Other])(
      "does not replay an ambiguous delete against a replacement on %s",
      async (provider) => {
         const f = fixture({ provider, timeoutAfterDelete: "replacement" });
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.deletes()).toHaveLength(1);
         expect(f.objects.get("old.txt")?.headers["x-amz-meta-color"]).toBe(
            "replacement"
         );
      }
   );
   it("recognizes an ambiguous delete that actually completed", async () => {
      const f = fixture({ timeoutAfterDelete: "absent" });
      await f.run();
      expect(f.deletes()).toHaveLength(1);
      expect([...f.objects.keys()]).toEqual(["new.txt"]);
   });
   it("never rolls back the destination after a delete permission error", async () => {
      const f = fixture({ deleteError: true });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.objects.size).toBe(2);
      expect(f.deletes()).toHaveLength(1);
      expect(f.deletes()[0]?.path).toMatch(/\/old\.txt$/);
   });
   it("aborts an incomplete multipart copy whose response has no ETag", async () => {
      const f = fixture({ provider: Provider.Other, partMissingETag: true });
      await expect(f.run()).rejects.toMatchObject({ status: 502 });
      expect(
         f.requests.some(
            (r) => r.method === "DELETE" && r.query.uploadId === "upload-1"
         )
      ).toBe(true);
      expect(f.deletes()).toHaveLength(0);
   });
   it("does not discard unreadable MinIO metadata", async () => {
      const f = fixture({
         provider: Provider.Other,
         sourceHeaders: { "x-amz-missing-meta": "1" },
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.writes()).toHaveLength(0);
   });
   it.each([
      { code: "NotImplemented", status: 501 },
      { code: "MethodNotAllowed", status: 405 },
   ])(
      "supports a compatible provider without a tagging API: $code",
      async (taggingError) => {
         const f = fixture({ provider: Provider.Other, taggingError });
         await f.run();
         expect(f.objects.has("old.txt")).toBe(false);
         expect(f.writes()[0]?.headers).not.toHaveProperty("x-amz-tagging");
      }
   );
   it("does not treat a tagging permission error as unsupported tags", async () => {
      const f = fixture({
         provider: Provider.Other,
         taggingError: { code: "AccessDenied", status: 403 },
      });
      await expect(f.run()).rejects.toMatchObject({ status: 403 });
      expect(f.writes()).toHaveLength(0);
   });
   it("does not discard reported tags when their API is unavailable", async () => {
      const f = fixture({
         provider: Provider.Other,
         sourceHeaders: { "x-amz-tagging-count": "1" },
         taggingError: { code: "NotImplemented", status: 501 },
      });
      await expect(f.run()).rejects.toMatchObject({ status: 502 });
      expect(f.writes()).toHaveLength(0);
   });
   it("does not silently treat malformed tag responses as empty tags", async () => {
      const f = fixture({ provider: Provider.Other, missingTagSet: true });
      await expect(f.run()).rejects.toMatchObject({ status: 502 });
      expect(f.writes()).toHaveLength(0);
   });
   it.each([Provider.S3, Provider.R2, Provider.Other])(
      "refuses a source changed before copy selection on %s",
      async (provider) => {
         const f = fixture({
            provider,
            beforeSelection: (objects) => {
               objects.get("old.txt")!.headers.etag = '"new-version"';
            },
         });
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.objects.has("new.txt")).toBe(false);
         expect(f.objects.get("old.txt")?.headers.etag).toBe('"new-version"');
         expect(f.deletes()).toHaveLength(0);
      }
   );
   it("does not claim success when an external writer removes the source and replaces the destination", async () => {
      const f = fixture({
         afterCommit: (objects) => {
            objects.delete("old.txt");
            objects.get("new.txt")!.headers.etag = '"another-file"';
         },
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.deletes()).toHaveLength(0);
   });
   it("does not claim success after a lost delete response if the destination has disappeared", async () => {
      const f = fixture({
         timeoutAfterDelete: "absent",
         afterDelete: (objects) => objects.delete("new.txt"),
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.deletes()).toHaveLength(1);
   });
   it.each([undefined, '"*"'])(
      "refuses invalid source ETag %s before writing",
      async (etag) => {
         const f = fixture({ sourceHeaders: { etag } });
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.writes()).toHaveLength(0);
      }
   );
});
