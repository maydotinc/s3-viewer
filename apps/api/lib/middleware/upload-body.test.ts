import express from "express";
import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { isObjectUpload } from "./upload-body";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
   await Promise.all(
      servers.splice(0).map(
         (server) =>
            new Promise<void>((resolve) => {
               server.closeAllConnections();
               server.close(() => resolve());
            })
      )
   );
});

describe("raw upload bodies", () => {
   it.each(["/objects/upload", "/objects/upload/", "/objects", "/objects/"])(
      "keeps JSON file contents intact on %s",
      async (suffix) => {
         const app = express();
         const json = express.json({ limit: "1mb" });
         app.use((req, res, next) =>
            isObjectUpload(req) ? next() : json(req, res, next)
         );
         app.put(
            [
               "/servers/:serverId/buckets/:bucketName/objects",
               "/servers/:serverId/buckets/:bucketName/objects/upload",
            ],
            async (req, res) => {
               const chunks: Buffer[] = [];
               for await (const chunk of req) chunks.push(Buffer.from(chunk));
               res.type("application/octet-stream").send(Buffer.concat(chunks));
            }
         );
         const server = createServer(app);
         servers.push(server);
         await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
         });
         const body = '{"backup":"' + "x".repeat(1024 * 1024) + '"}';
         const port = (server.address() as AddressInfo).port;
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
