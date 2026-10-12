import { errorHandler } from "@/lib/http";
import cors from "cors";
import express, { type Express, type Request } from "express";
import { connect, type Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testServers } from "@/lib/testing/test-server";
import { authBodyLimit } from "./auth-body";
import { requestBodyGuard } from "./request-body";
import { withUploadSlot } from "./upload-slot";

const BODY_TIMEOUT = 150;
const listen = testServers();
const clients: Socket[] = [];
const intervals: ReturnType<typeof setInterval>[] = [];

afterEach(() => {
   intervals.splice(0).forEach(clearInterval);
   clients.splice(0).forEach((client) => client.destroy());
});

const serve = async (configure: (app: Express) => void) => {
   const app = express();
   app.use((req, _res, next) => {
      req.setTimeout(1000);
      next();
   });
   app.use(requestBodyGuard(BODY_TIMEOUT));
   configure(app);
   app.use(errorHandler);
   return (await listen(app, { requestTimeout: 0 })).port;
};

const open = async (port: number) => {
   const socket = connect(port, "127.0.0.1");
   clients.push(socket);
   let received = "";
   socket.setEncoding("utf8");
   socket.on("data", (chunk: string) => {
      received += chunk;
   });
   socket.on("error", () => undefined);
   const closed = new Promise<string>((resolve) => {
      socket.once("close", () => resolve(received));
   });
   await new Promise<void>((resolve) => socket.once("connect", resolve));
   return {
      socket,
      closed,
      received: () => received,
      until: (test: (text: string) => boolean) =>
         new Promise<void>((resolve) => {
            const check = () => {
               if (!test(received)) return;
               socket.off("data", check);
               resolve();
            };
            socket.on("data", check);
            check();
         }),
   };
};

const headers = (
   method: string,
   path: string,
   framing = "Content-Length: 65536",
   extra = ""
) =>
   `${method} ${path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n${framing}\r\n${extra}\r\n`;

const drip = (socket: Socket, chunk: string) => {
   const interval = setInterval(() => {
      if (!socket.destroyed) socket.write(chunk);
   }, 20);
   intervals.push(interval);
   return interval;
};

describe("request body deadlines on real HTTP connections", () => {
   it.each([
      ["GET", "Content-Length: 65536"],
      ["HEAD", "Content-Length: 65536"],
      ["GET", "Transfer-Encoding: chunked"],
      ["HEAD", "Transfer-Encoding: chunked"],
   ])(
      "rejects %s bodies framed by %s before parsing",
      async (method, framing) => {
         const handler = vi.fn();
         const port = await serve((app) => {
            app.all("/auth/{*any}", authBodyLimit, handler);
         });
         const client = await open(port);
         client.socket.write(headers(method, "/auth/get-session", framing));
         const response = await client.closed;
         expect(response).toContain("HTTP/1.1 400");
         expect(response).toMatch(/Connection: close/i);
         expect(handler).not.toHaveBeenCalled();
      }
   );

   it.each([
      ["Content-Length: 65536", " "],
      ["Transfer-Encoding: chunked", "1\r\n \r\n"],
   ])(
      "stops a trickled auth body using %s despite ongoing progress",
      async (framing, chunk) => {
         const handler = vi.fn();
         const port = await serve((app) => {
            app.post("/auth/sign-in/email", authBodyLimit, handler);
         });
         const client = await open(port);
         client.socket.write(headers("POST", "/auth/sign-in/email", framing));
         drip(client.socket, chunk);
         const response = await client.closed;
         expect(response).toContain("HTTP/1.1 408");
         expect(response).toContain("Request body took too long to arrive");
         expect(handler).not.toHaveBeenCalled();
      }
   );

   it.each([429, 401])(
      "closes unread bodies after an early %s response",
      async (status) => {
         const port = await serve((app) => {
            app.use((_req, res) => {
               res.status(status).json({ message: "Refused" });
            });
         });
         const client = await open(port);
         client.socket.write(
            headers("PUT", "/servers/a/buckets/b/objects/v3/upload")
         );
         drip(client.socket, " ");
         const response = await client.closed;
         expect(response).toContain(`HTTP/1.1 ${status}`);
         expect(response).toContain("Refused");
         expect(response).not.toContain("408");
      }
   );

   it("closes unread bodies when CORS answers a preflight", async () => {
      const port = await serve((app) => {
         app.use(cors());
      });
      const client = await open(port);
      client.socket.write(headers("OPTIONS", "/auth/sign-in/email"));
      const response = await client.closed;
      expect(response).toContain("HTTP/1.1 204");
   });

   it("preserves an early parser error while closing its unread body", async () => {
      const port = await serve((app) => {
         app.post("/auth/sign-in/email", authBodyLimit, (_req, res) => {
            res.end();
         });
      });
      const client = await open(port);
      client.socket.write(
         headers(
            "POST",
            "/auth/sign-in/email",
            "Content-Length: 65536",
            "Content-Encoding: gzip\r\n"
         )
      );
      const response = await client.closed;
      expect(response).toContain("HTTP/1.1 415");
      expect(response).toContain("Unsupported request encoding");
   });

   it("closes a timed-out body after response headers have already been sent", async () => {
      const port = await serve((app) => {
         app.post("/stream", (_req, res) => {
            res.write("started");
         });
      });
      const client = await open(port);
      client.socket.write(headers("POST", "/stream"));
      drip(client.socket, " ");
      const response = await client.closed;
      expect(response).toContain("HTTP/1.1 200");
      expect(response).toContain("started");
      expect(response).not.toContain("408");
   });

   it("allows a fully received body to wait for middleware before parsing", async () => {
      let completeBeforeParsing = false;
      const port = await serve((app) => {
         app.post(
            "/auth/deferred",
            (req, _res, next) => {
               setTimeout(() => {
                  completeBeforeParsing = req.complete;
                  next();
               }, BODY_TIMEOUT * 2);
            },
            authBodyLimit,
            (req, res) => {
               res.json({ body: req.body });
            }
         );
      });
      const client = await open(port);
      client.socket.write(
         headers(
            "POST",
            "/auth/deferred",
            "Content-Length: 2",
            "Connection: close\r\n"
         ) + "{}"
      );
      const response = await client.closed;
      expect(completeBeforeParsing).toBe(true);
      expect(response).toContain("HTTP/1.1 200");
      expect(response).toContain('"body":"{}"');
      expect(response).not.toContain("408");
   });

   it("allows bodyless requests to wait longer than the body deadline", async () => {
      const port = await serve((app) => {
         app.get("/slow", (_req, res) => {
            setTimeout(() => res.json({ ok: true }), BODY_TIMEOUT * 2);
         });
      });
      const client = await open(port);
      client.socket.write(
         headers("GET", "/slow", "Content-Length: 0", "Connection: close\r\n")
      );
      expect(await client.closed).toContain('"ok":true');
   });

   it("clears completed-body timers and keeps the connection usable", async () => {
      const port = await serve((app) => {
         app.post("/auth/echo", authBodyLimit, (req, res) => {
            setTimeout(() => res.json({ body: req.body }), BODY_TIMEOUT * 2);
         });
         app.get("/next", (_req, res) => {
            res.json({ next: true });
         });
      });
      const client = await open(port);
      client.socket.write(
         headers("POST", "/auth/echo", "Content-Length: 2") + "{}"
      );
      await client.until((text) => text.includes('"body":"{}"'));
      expect(client.socket.destroyed).toBe(false);
      client.socket.write(
         headers("GET", "/next", "Content-Length: 0", "Connection: close\r\n")
      );
      const response = await client.closed;
      expect(response.match(/HTTP\/1.1 200/g)).toHaveLength(2);
      expect(response).toContain('"next":true');
      expect(response).not.toContain("408");
   });

   it("retains the deadline while a raw upload awaits authentication", async () => {
      const port = await serve((app) => {
         app.put("/servers/a/buckets/b/objects/v3/upload", () => undefined);
      });
      const client = await open(port);
      client.socket.write(
         headers("PUT", "/servers/a/buckets/b/objects/v3/upload")
      );
      drip(client.socket, " ");
      expect(await client.closed).toContain("HTTP/1.1 408");
   });

   it("hands admitted uploads to their streaming watchdog without losing bytes", async () => {
      const port = await serve((app) => {
         app.put("/upload", async (req, res, next) => {
            try {
               const body = await withUploadSlot(
                  req,
                  res,
                  {
                     userId: "body-guard-test",
                     reservation: 1024,
                  },
                  async () => {
                     const chunks: Buffer[] = [];
                     for await (const chunk of req)
                        chunks.push(Buffer.from(chunk));
                     return Buffer.concat(chunks).toString();
                  }
               );
               res.json({ body });
            } catch (error) {
               next(error);
            }
         });
      });
      const client = await open(port);
      client.socket.write(
         headers(
            "PUT",
            "/upload",
            "Content-Length: 20",
            "Connection: close\r\n"
         )
      );
      drip(client.socket, "x");
      const response = await client.closed;
      expect(response).toContain("HTTP/1.1 200");
      expect(response).toContain('"body":"' + "x".repeat(20) + '"');
      expect(response).not.toContain("408");
   });

   it("removes deadline listeners when the client disconnects", async () => {
      let pending: Request | undefined;
      const port = await serve((app) => {
         app.post("/pending", (req) => {
            pending = req;
         });
      });
      const client = await open(port);
      client.socket.write(headers("POST", "/pending"));
      await vi.waitFor(() => expect(pending).toBeDefined());
      client.socket.destroy();
      await vi.waitFor(() => expect(pending?.aborted).toBe(true));
      expect(pending?.listenerCount("end")).toBe(0);
      expect(pending?.listenerCount("aborted")).toBe(0);
   });
});
