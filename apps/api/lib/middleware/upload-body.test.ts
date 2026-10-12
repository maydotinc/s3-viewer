import express from "express";
import { request } from "node:http";
import { describe, expect, it } from "vitest";
import { testServers } from "@/lib/testing/test-server";
import { isObjectUpload, readsQueryFields } from "./upload-body";

const serve = testServers();

const OBJECTS = "/servers/server123/buckets/backups/objects";

const probe = (
   method: string,
   baseUrl: string,
   path: string,
   contentType?: string
) => ({ method, baseUrl, path, headers: { "content-type": contentType } });

describe("readsQueryFields", () => {
   it("reads a part's fields from the query whatever its content type", () => {
      const parts = "/v3/multipart-uploads/parts";
      expect(readsQueryFields(probe("PUT", OBJECTS, parts, "text/plain"))).toBe(
         true
      );
      expect(readsQueryFields(probe("PUT", OBJECTS, parts))).toBe(true);
      expect(readsQueryFields(probe("PUT", OBJECTS, "/v3/upload"))).toBe(true);
      expect(readsQueryFields(probe("POST", OBJECTS, parts))).toBe(false);
      expect(readsQueryFields(probe("POST", OBJECTS, "/v3/rename"))).toBe(
         false
      );
   });
});

describe("raw upload bodies", () => {
   it.each(["/objects/v3/upload", "/objects/v3/upload/"])(
      "keeps JSON file contents intact on %s",
      async (suffix) => {
         const app = express();
         const json = express.json({ limit: "1mb" });
         app.use((req, res, next) =>
            isObjectUpload(req) ? next() : json(req, res, next)
         );
         app.put(
            "/servers/:serverId/buckets/:bucketName/objects/v3/upload",
            async (req, res) => {
               const chunks: Buffer[] = [];
               for await (const chunk of req) chunks.push(Buffer.from(chunk));
               res.type("application/octet-stream").send(Buffer.concat(chunks));
            }
         );
         const { port } = await serve(app);
         const body = '{"backup":"' + "x".repeat(1024 * 1024) + '"}';
         const actual = await new Promise<string>((resolve, reject) => {
            const req = request(
               {
                  hostname: "127.0.0.1",
                  port,
                  path: `/servers/server123/buckets/backups${suffix}`,
                  method: "PUT",
                  headers: {
                     "content-type": "application/json",
                     "content-length": String(Buffer.byteLength(body)),
                  },
               },
               (res) => {
                  let result = "";
                  res.setEncoding("utf8");
                  res.on("data", (chunk) => {
                     result += chunk;
                  });
                  res.on("end", () => resolve(result));
               }
            );
            req.on("error", reject);
            req.end(body);
         });
         expect(actual).toBe(body);
      }
   );
});
