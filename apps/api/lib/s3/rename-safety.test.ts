import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { renameObject } from "./rename";

type Request = {
   method: string;
   path: string;
   query: Record<string, string>;
   headers: Record<string, string>;
};
type Stored = { data: string; tags: Record<string, string> };
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
const fixture = (
   options: {
      sourceHeaders?: Record<string, string>;
      afterCopy?: (objects: Map<string, Stored>) => void;
      taggingDenied?: boolean;
      malformedTags?: boolean;
      emptyTags?: boolean;
      lockEnabled?: boolean;
      lockDenied?: "configuration" | "retention" | "legal-hold";
      lockChanged?:
         | "configuration"
         | "retention"
         | "legal-hold"
         | "destination";
   } = {}
) => {
   const objects = new Map<string, Stored>([
      [
         "old.txt",
         {
            data: "original",
            tags: options.emptyTags ? {} : { classification: "public" },
         },
      ],
   ]);
   const requests: Request[] = [];
   let copied = false;
   const client = new S3Client({
      endpoint: "https://s3.us-east-1.amazonaws.com",
      region: "us-east-1",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      forcePathStyle: true,
      requestHandler: {
         handle: async (request: Request) => {
            requests.push(request);
            const key = decodeURIComponent(
               request.path.split("/").at(-1) ?? ""
            );
            if (request.method === "HEAD") {
               const object = objects.get(key);
               return object
                  ? response("", 200, {
                       etag: '"unchanged-content"',
                       "content-length": "8",
                       "content-type": "text/plain",
                       "x-amz-tagging-count": String(
                          Object.keys(object.tags).length
                       ),
                       ...options.sourceHeaders,
                    })
                  : response("<Error><Code>NotFound</Code></Error>", 404);
            }
            if ("object-lock" in request.query) {
               if (options.lockDenied === "configuration")
                  return response(
                     "<Error><Code>AccessDenied</Code></Error>",
                     403
                  );
               if (!options.lockEnabled)
                  return response(
                     "<Error><Code>ObjectLockConfigurationNotFoundError</Code></Error>",
                     404
                  );
               return response(
                  `<ObjectLockConfiguration><ObjectLockEnabled>Enabled</ObjectLockEnabled>${copied && options.lockChanged === "configuration" ? "<Rule><DefaultRetention><Mode>GOVERNANCE</Mode><Days>30</Days></DefaultRetention></Rule>" : ""}</ObjectLockConfiguration>`
               );
            }
            if ("retention" in request.query) {
               if (options.lockDenied === "retention")
                  return response(
                     "<Error><Code>AccessDenied</Code></Error>",
                     403
                  );
               const changed =
                  copied &&
                  options.lockChanged === "retention" &&
                  key === "old.txt";
               return response(
                  `<Retention><Mode>${changed ? "GOVERNANCE" : "COMPLIANCE"}</Mode><RetainUntilDate>2035-01-01T00:00:00Z</RetainUntilDate></Retention>`
               );
            }
            if ("legal-hold" in request.query) {
               if (options.lockDenied === "legal-hold")
                  return response(
                     "<Error><Code>AccessDenied</Code></Error>",
                     403
                  );
               const changed =
                  copied &&
                  ((options.lockChanged === "legal-hold" &&
                     key === "old.txt") ||
                     (options.lockChanged === "destination" &&
                        key === "new.txt"));
               return response(
                  `<LegalHold><Status>${changed ? "OFF" : "ON"}</Status></LegalHold>`
               );
            }
            if ("ownershipControls" in request.query)
               return response(
                  "<OwnershipControls><Rule><ObjectOwnership>BucketOwnerEnforced</ObjectOwnership></Rule></OwnershipControls>"
               );
            if ("tagging" in request.query) {
               if (options.taggingDenied)
                  return response(
                     "<Error><Code>AccessDenied</Code></Error>",
                     403
                  );
               if (options.malformedTags) return response("<Tagging/>");
               return response(
                  `<Tagging><TagSet>${Object.entries(objects.get(key)!.tags)
                     .map(
                        ([tag, value]) =>
                           `<Tag><Key>${tag}</Key><Value>${value}</Value></Tag>`
                     )
                     .join("")}</TagSet></Tagging>`
               );
            }
            if (request.method === "PUT") {
               objects.set("new.txt", structuredClone(objects.get("old.txt")!));
               copied = true;
               options.afterCopy?.(objects);
               return response(
                  '<CopyObjectResult><ETag>"unchanged-content"</ETag></CopyObjectResult>'
               );
            }
            if (request.method === "DELETE") {
               expect(request.headers["if-match"]).toBe('"unchanged-content"');
               objects.delete(key);
               return response("", 204);
            }
            throw new Error(`Unexpected command: ${request.method}`);
         },
      },
   });
   return {
      client,
      objects,
      requests,
      writes: () =>
         requests.filter(
            ({ method }) => method === "PUT" || method === "DELETE"
         ),
      run: () =>
         renameObject(
            { client, bucket: "bucket" },
            "old.txt",
            "new.txt",
            '"unchanged-content"'
         ),
   };
};

describe("rename object settings safety", () => {
   it("preserves retention and legal hold even when HEAD does not disclose them", async () => {
      const f = fixture({ lockEnabled: true });
      try {
         await f.run();
         const copy = f.requests.find(({ method }) => method === "PUT");
         expect(copy?.headers).toMatchObject({
            "x-amz-object-lock-mode": "COMPLIANCE",
            "x-amz-object-lock-retain-until-date": "2035-01-01T00:00:00Z",
            "x-amz-object-lock-legal-hold": "ON",
         });
         expect(f.objects.has("old.txt")).toBe(false);
      } finally {
         f.client.destroy();
      }
   });

   it.each(["configuration", "retention", "legal-hold"] as const)(
      "does not copy when %s cannot be read despite omitted HEAD lock fields",
      async (lockDenied) => {
         const f = fixture({ lockEnabled: true, lockDenied });
         try {
            await expect(f.run()).rejects.toMatchObject({ status: 403 });
            expect(f.writes()).toHaveLength(0);
            expect(f.objects.has("old.txt")).toBe(true);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each([
      "configuration",
      "retention",
      "legal-hold",
      "destination",
   ] as const)(
      "retains the source when %s lock state differs after copy",
      async (lockChanged) => {
         const f = fixture({ lockEnabled: true, lockChanged });
         try {
            await expect(f.run()).rejects.toMatchObject({ status: 409 });
            expect(f.objects.has("old.txt")).toBe(true);
            expect(f.requests.some(({ method }) => method === "DELETE")).toBe(
               false
            );
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each([false, true])(
      "verifies source and destination tags, including empty tag sets (%s)",
      async (emptyTags) => {
         const f = fixture({ emptyTags });
         try {
            await f.run();
            expect(f.objects.has("old.txt")).toBe(false);
            expect(f.objects.get("new.txt")?.tags).toEqual(
               emptyTags ? {} : { classification: "public" }
            );
            expect(
               f.requests
                  .filter((r) => "tagging" in r.query)
                  .map((r) => r.path.split("/").at(-1))
            ).toEqual(["old.txt", "new.txt", "old.txt"]);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each(["old.txt", "new.txt"])(
      "retains the source when %s tags change without changing content or tag count",
      async (key) => {
         const f = fixture({
            afterCopy: (objects) => {
               objects.get(key)!.tags.classification = "private";
            },
         });
         try {
            await expect(f.run()).rejects.toMatchObject({ status: 409 });
            expect(f.objects.has("old.txt")).toBe(true);
            expect(f.requests.some((r) => r.method === "DELETE")).toBe(false);
            expect(f.objects.get(key)?.tags.classification).toBe("private");
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each([
      { taggingDenied: true, status: 403 },
      { malformedTags: true, status: 502 },
   ])(
      "does not copy when source tags cannot be verified: %j",
      async (options) => {
         const f = fixture(options);
         try {
            await expect(f.run()).rejects.toMatchObject({
               status: options.status,
            });
            expect(f.writes()).toHaveLength(0);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each<Record<string, string>>([
      { "x-amz-server-side-encryption": "aws:kms" },
      { "x-amz-server-side-encryption": "aws:kms:dsse" },
      { "x-amz-server-side-encryption-customer-algorithm": "AES256" },
   ])(
      "does not copy encryption settings that cannot be fully preserved: %j",
      async (sourceHeaders) => {
         const f = fixture({ sourceHeaders });
         try {
            await expect(f.run()).rejects.toMatchObject({
               status: 409,
               message: expect.stringContaining("encryption settings"),
            });
            expect(f.writes()).toHaveLength(0);
         } finally {
            f.client.destroy();
         }
      }
   );
});
