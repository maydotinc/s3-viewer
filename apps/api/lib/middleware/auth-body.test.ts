import { toNodeHandler } from "better-auth/node";
import express from "express";
import { request } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "@/lib/http";
import { testServers } from "@/lib/testing/test-server";
import { authBodyLimit } from "./auth-body";

const MAX_AUTH_BODY_BYTES = 64 * 1024;

const serve = testServers();

const send = async (
   chunks: string[],
   extraHeaders: Record<string, string> = {}
) => {
   const handler = vi.fn(async (req: Request) =>
      Response.json(await req.json())
   );
   const app = express();
   app.all("/auth/{*any}", authBodyLimit, toNodeHandler(handler));
   app.use(errorHandler);
   const { port } = await serve(app);
   const result = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
         const req = request(
            {
               hostname: "127.0.0.1",
               port,
               path: "/auth/sign-in/email",
               method: "POST",
               headers: { "content-type": "application/json", ...extraHeaders },
            },
            (res) => {
               let body = "";
               res.setEncoding("utf8");
               res.on("data", (chunk) => {
                  body += chunk;
               });
               res.on("end", () =>
                  resolve({ status: res.statusCode ?? 0, body })
               );
            }
         );
         req.on("error", reject);
         for (const chunk of chunks) req.write(chunk);
         req.end();
      }
   );
   return { ...result, handler };
};

describe("auth body limit with the real Better Auth Node adapter", () => {
   it("preserves valid JSON for the auth handler", async () => {
      const payload = JSON.stringify({
         email: "a@example.com",
         password: "pässword123",
      });
      const result = await send([payload], {
         "content-length": String(Buffer.byteLength(payload)),
      });
      expect(result.status).toBe(200);
      expect(JSON.parse(result.body)).toEqual(JSON.parse(payload));
   });
   it("rejects an oversized declared body before auth runs", async () => {
      const body = JSON.stringify({ value: "x".repeat(MAX_AUTH_BODY_BYTES) });
      const result = await send([body], {
         "content-length": String(body.length),
      });
      expect(result.status).toBe(413);
      expect(result.handler).not.toHaveBeenCalled();
   });
   it("enforces the cap on chunked requests too", async () => {
      const result = await send([
         '{"value":"',
         "x".repeat(MAX_AUTH_BODY_BYTES),
         '"}',
      ]);
      expect(result.status).toBe(413);
      expect(result.handler).not.toHaveBeenCalled();
   });
   it("does not buffer a compressed auth body", async () => {
      const result = await send(["compressed"], { "content-encoding": "gzip" });
      expect(result.status).toBe(415);
      expect(result.handler).not.toHaveBeenCalled();
   });
});
