import { once } from "node:events";
import { createServer, type Socket } from "node:net";
import { networkInterfaces } from "node:os";
import {
   createSecureContext,
   createServer as createTlsServer,
   TLSSocket,
} from "node:tls";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
   deliverEmail,
   resendDelivery,
   smtpDelivery,
   type EmailMessage,
} from "./delivery";
import { tlsOptions } from "./testing/tls-fixture";

const message: EmailMessage = {
   from: "sender@example.com",
   to: "recipient@example.com",
   subject: "Review fixture",
   html: "<p>Test</p>",
   text: "Test",
};

afterEach(() => {
   vi.useRealTimers();
   vi.unstubAllGlobals();
});

const account = { lane: "account" } as const;
const invite = { lane: "invite" } as const;
const authLink = { lane: "account", retry: true } as const;

const fail = (props: Record<string, unknown>) =>
   Object.assign(new Error("Provider failed"), props);

describe("delivery budget", () => {
   it("aborts a stalled Resend request and releases its slot", async () => {
      vi.useFakeTimers();
      let aborted = false;
      vi.stubGlobal(
         "fetch",
         vi.fn(
            (_url, options: RequestInit) =>
               new Promise((_resolve, reject) => {
                  options.signal!.addEventListener(
                     "abort",
                     () => {
                        aborted = true;
                        reject(options.signal!.reason);
                     },
                     { once: true }
                  );
               })
         )
      );
      const delivery = deliverEmail(resendDelivery("test"), message, account);
      const rejection = expect(delivery).rejects.toThrow(
         "Email delivery timed out"
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await rejection;
      expect(aborted).toBe(true);
      await expect(
         deliverEmail(async () => {}, message, account)
      ).resolves.toBeUndefined();
   });

   it("bounds overlapping deliveries per lane and releases slots after provider failures", async () => {
      let release!: (error: Error) => void;
      const stalled = new Promise<void>((_resolve, reject) => {
         release = reject;
      });
      const calls = Array.from({ length: 10 }, () =>
         deliverEmail(() => stalled, message, invite)
      );
      const settled = Promise.allSettled(calls);
      await expect(
         deliverEmail(async () => {}, message, invite)
      ).rejects.toThrow("busy");
      release(new Error("Provider unavailable"));
      expect(
         (await settled).every((result) => result.status === "rejected")
      ).toBe(true);
      await expect(
         deliverEmail(async () => {}, message, invite)
      ).resolves.toBeUndefined();
   });

   it("keeps capacity for auth links while invites fill their own pool", async () => {
      let release!: () => void;
      const stalled = new Promise<void>((resolve) => {
         release = resolve;
      });
      const invites = Array.from({ length: 10 }, () =>
         deliverEmail(() => stalled, message, invite)
      );
      await expect(
         deliverEmail(async () => {}, message, invite)
      ).rejects.toThrow("busy");
      const links = Array.from({ length: 10 }, () =>
         deliverEmail(async () => {}, message, authLink)
      );
      await expect(Promise.all(links)).resolves.toHaveLength(10);
      release();
      await Promise.all(invites);
   });

   it("passes Resend errors through without retrying a possibly delivered message", async () => {
      const fetch = vi.fn().mockResolvedValue(
         new Response(
            JSON.stringify({
               name: "rate_limit_exceeded",
               message: "Wait",
            }),
            { status: 429 }
         )
      );
      vi.stubGlobal("fetch", fetch);
      await expect(
         deliverEmail(resendDelivery("test"), message, authLink)
      ).rejects.toThrow("rate_limit_exceeded: Wait");
      expect(fetch).toHaveBeenCalledTimes(1);
   });

   it("retries an auth link once, two seconds after a provider server error", async () => {
      vi.useFakeTimers();
      const fetch = vi
         .fn()
         .mockResolvedValueOnce(
            new Response(
               JSON.stringify({ name: "internal_server_error", message: "x" }),
               { status: 500 }
            )
         )
         .mockResolvedValueOnce(
            new Response(JSON.stringify({ id: "sent" }), { status: 200 })
         );
      vi.stubGlobal("fetch", fetch);
      const delivery = deliverEmail(resendDelivery("test"), message, authLink);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(delivery).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(2);
   });

   it("retries an auth link after a timeout, but only once", async () => {
      vi.useFakeTimers();
      const deliver = vi.fn(
         (_message: EmailMessage, signal: AbortSignal) =>
            new Promise<void>((_resolve, reject) => {
               signal.addEventListener("abort", () => reject(signal.reason), {
                  once: true,
               });
            })
      );
      const delivery = deliverEmail(deliver, message, authLink);
      const rejection = expect(delivery).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(10_000 + 2_000 + 10_000);
      await rejection;
      expect(deliver).toHaveBeenCalledTimes(2);
   });

   it.each([
      ["a temporary SMTP reply", fail({ responseCode: 451 }), 2],
      ["an SMTP timeout", fail({ code: "ETIMEDOUT" }), 2],
      ["a socket error", fail({ code: "ESOCKET" }), 2],
      ["a dropped connection", fail({ code: "ECONNECTION" }), 2],
      ["a DNS failure", fail({ code: "EDNS" }), 2],
      ["a TLS failure", fail({ code: "ETLS" }), 1],
      ["an auth failure", fail({ code: "EAUTH", responseCode: 535 }), 1],
      ["a permanent SMTP reply", fail({ responseCode: 550 }), 1],
      ["an unclassified error", new Error("Bad address"), 1],
   ])(
      "retries an auth link after %s only when transient",
      async (_name, error, calls) => {
         vi.useFakeTimers();
         const deliver = vi.fn(async () => {
            throw error;
         });
         const delivery = deliverEmail(deliver, message, authLink);
         const rejection = expect(delivery).rejects.toBe(error);
         await vi.advanceTimersByTimeAsync(2_000);
         await rejection;
         expect(deliver).toHaveBeenCalledTimes(calls);
      }
   );

   it("never retries an invite", async () => {
      const deliver = vi.fn(async () => {
         throw fail({ responseCode: 451 });
      });
      await expect(deliverEmail(deliver, message, invite)).rejects.toThrow(
         "Provider failed"
      );
      expect(deliver).toHaveBeenCalledTimes(1);
   });
});

it.each(["greeting", "message"])(
   "closes a real SMTP socket stalled during %s",
   async (phase) => {
      let peer: Socket | undefined;
      let accepted!: () => void;
      const connected = new Promise<void>((resolve) => {
         accepted = resolve;
      });
      const server = createServer((socket) => {
         peer = socket;
         socket.on("error", () => {});
         if (phase === "greeting") {
            accepted();
            return;
         }
         socket.write("220 localhost SMTP\r\n");
         let buffered = "";
         socket.on("data", (chunk) => {
            buffered += chunk.toString();
            let end: number;
            while ((end = buffered.indexOf("\r\n")) !== -1) {
               const line = buffered.slice(0, end);
               buffered = buffered.slice(end + 2);
               if (line.startsWith("EHLO")) socket.write("250 localhost\r\n");
               else if (
                  line.startsWith("MAIL FROM") ||
                  line.startsWith("RCPT TO")
               )
                  socket.write("250 OK\r\n");
               else if (line === "DATA") socket.write("354 Send message\r\n");
               else if (line === ".") accepted();
            }
         });
      }).listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string")
         throw new Error("No test port");
      const controller = new AbortController();
      const sending = smtpDelivery(`smtp://127.0.0.1:${address.port}`)(
         message,
         controller.signal
      );
      const rejection = expect(sending).rejects.toThrow();
      try {
         await connected;
         const closed = once(peer!, "close");
         controller.abort(new Error("Fixture deadline"));
         await rejection;
         await closed;
         expect(peer!.destroyed).toBe(true);
      } finally {
         peer?.destroy();
         server.close();
      }
   }
);

it.each(["implicit", "starttls"] as const)(
   "preserves %s TLS and cancels after the handshake",
   async (mode) => {
      const peers = new Set<Socket>();
      const subjects: string[] = [];
      let accepted!: () => void;
      const received = new Promise<void>((resolve) => {
         accepted = resolve;
      });
      let messages = 0;
      const protocol = (socket: Socket, secure: boolean) => {
         peers.add(socket);
         socket.on("error", () => {});
         let buffered = "";
         const onData = (chunk: Buffer) => {
            buffered += chunk.toString();
            let end: number;
            while ((end = buffered.indexOf("\r\n")) !== -1) {
               const line = buffered.slice(0, end);
               buffered = buffered.slice(end + 2);
               if (line.startsWith("EHLO")) {
                  socket.write(
                     secure
                        ? "250 localhost\r\n"
                        : "250-localhost\r\n250 STARTTLS\r\n"
                  );
               } else if (line === "STARTTLS" && !secure) {
                  socket.removeListener("data", onData);
                  socket.write("220 Upgrade\r\n");
                  const tls = new TLSSocket(socket, {
                     isServer: true,
                     secureContext: createSecureContext(tlsOptions),
                  });
                  protocol(tls, true);
                  return;
               } else if (
                  line.startsWith("MAIL FROM") ||
                  line.startsWith("RCPT TO")
               ) {
                  expect(secure).toBe(true);
                  socket.write("250 OK\r\n");
               } else if (line === "DATA") {
                  expect(secure).toBe(true);
                  socket.write("354 Send message\r\n");
               } else if (line.startsWith("Subject:")) {
                  subjects.push(line);
               } else if (line === ".") {
                  messages++;
                  if (messages === 1) socket.write("250 Accepted\r\n");
                  else accepted();
               }
            }
         };
         socket.on("data", onData);
      };
      const server =
         mode === "implicit"
            ? createTlsServer(tlsOptions, (socket) => {
                 protocol(socket, true);
                 socket.write("220 localhost SMTP\r\n");
              })
            : createServer((socket) => {
                 protocol(socket, false);
                 socket.write("220 localhost SMTP\r\n");
              });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string")
         throw new Error("No test port");
      const scheme = mode === "implicit" ? "smtps" : "smtp";
      const url = `${scheme}://127.0.0.1:${address.port}?tls.rejectUnauthorized=false&requireTLS=true`;
      const controller = new AbortController();
      try {
         await expect(
            smtpDelivery(url)(message, controller.signal)
         ).resolves.toBeUndefined();
         const sending = smtpDelivery(url)(message, controller.signal);
         const rejection = expect(sending).rejects.toThrow();
         await received;
         controller.abort(new Error("Fixture deadline"));
         await rejection;
         expect(subjects).toEqual([
            "Subject: Review fixture",
            "Subject: Review fixture",
         ]);
      } finally {
         for (const peer of peers) peer.destroy();
         server.close();
      }
   }
);

describe("an SMTP server that does not offer STARTTLS", () => {
   const plaintextServer = async (bindHost = "127.0.0.1") => {
      const commands: string[] = [];
      const peers = new Set<Socket>();
      const server = createServer((socket) => {
         peers.add(socket);
         socket.on("error", () => {});
         socket.write("220 localhost SMTP\r\n");
         let buffered = "";
         let inData = false;
         socket.on("data", (chunk) => {
            buffered += chunk.toString();
            let end: number;
            while ((end = buffered.indexOf("\r\n")) !== -1) {
               const line = buffered.slice(0, end);
               buffered = buffered.slice(end + 2);
               if (inData) {
                  if (line === ".") {
                     inData = false;
                     socket.write("250 Accepted\r\n");
                  }
                  continue;
               }
               commands.push(line.split(" ")[0]!);
               if (line.startsWith("EHLO"))
                  socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
               else if (line.startsWith("AUTH"))
                  socket.write("235 Authenticated\r\n");
               else if (
                  line.startsWith("MAIL FROM") ||
                  line.startsWith("RCPT TO")
               )
                  socket.write("250 OK\r\n");
               else if (line === "DATA") {
                  inData = true;
                  socket.write("354 Send message\r\n");
               } else if (line === "QUIT") socket.end("221 Bye\r\n");
               else socket.write("502 Not implemented\r\n");
            }
         });
      }).listen(0, bindHost);
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string")
         throw new Error("No test port");
      return {
         commands,
         port: address.port,
         close: () => {
            for (const peer of peers) peer.destroy();
            server.close();
         },
      };
   };

   it("refuses to send credentials in clear text", async () => {
      const server = await plaintextServer();
      try {
         await expect(
            smtpDelivery(`smtp://user:secret@127.0.0.1:${server.port}`)(
               message,
               new AbortController().signal
            )
         ).rejects.toThrow();
         expect(server.commands).toContain("STARTTLS");
         expect(server.commands).not.toContain("AUTH");
      } finally {
         server.close();
      }
   });

   it("authenticates in clear text only when the URL opts out", async () => {
      const server = await plaintextServer();
      try {
         await expect(
            smtpDelivery(
               `smtp://user:secret@127.0.0.1:${server.port}?requireTLS=false`
            )(message, new AbortController().signal)
         ).resolves.toBeUndefined();
         expect(server.commands).toContain("AUTH");
      } finally {
         server.close();
      }
   });

   const externalAddress = Object.values(networkInterfaces())
      .flat()
      .find((entry) => entry?.family === "IPv4" && !entry.internal)?.address;

   it.skipIf(!externalAddress)(
      "refuses a plaintext session to a non-loopback host even without credentials",
      async () => {
         const server = await plaintextServer(externalAddress);
         try {
            await expect(
               smtpDelivery(`smtp://${externalAddress}:${server.port}`)(
                  message,
                  new AbortController().signal
               )
            ).rejects.toThrow();
            expect(server.commands).toContain("STARTTLS");
            expect(server.commands).not.toContain("MAIL");
         } finally {
            server.close();
         }
      }
   );

   it.skipIf(!externalAddress)(
      "allows plaintext to a non-loopback host only with ignoreTLS",
      async () => {
         const server = await plaintextServer(externalAddress);
         try {
            await expect(
               smtpDelivery(
                  `smtp://${externalAddress}:${server.port}?ignoreTLS=true`
               )(message, new AbortController().signal)
            ).resolves.toBeUndefined();
            expect(server.commands).not.toContain("STARTTLS");
         } finally {
            server.close();
         }
      }
   );

   it("still delivers without credentials, as to a local catcher", async () => {
      const server = await plaintextServer();
      try {
         await expect(
            smtpDelivery(`smtp://127.0.0.1:${server.port}`)(
               message,
               new AbortController().signal
            )
         ).resolves.toBeUndefined();
         expect(server.commands).not.toContain("STARTTLS");
      } finally {
         server.close();
      }
   });
});

describe("SMTP proxy validation", () => {
   it.each(["not a URL", "socks5://127.0.0.1:1080", "ftp://proxy.example"])(
      "rejects %s when the delivery is constructed",
      (proxy) => {
         expect(() =>
            smtpDelivery(
               `smtp://mail.example.test?proxy=${encodeURIComponent(proxy)}`
            )
         ).toThrow();
      }
   );

   it("accepts an HTTP proxy URL", () => {
      expect(() =>
         smtpDelivery(
            `smtp://mail.example.test?proxy=${encodeURIComponent("http://127.0.0.1:3128")}`
         )
      ).not.toThrow();
   });
});

it("still rejects an untrusted SMTP TLS certificate", async () => {
   const peers = new Set<Socket>();
   const server = createTlsServer(tlsOptions);
   server.on("connection", (socket) => {
      peers.add(socket);
      socket.on("error", () => {});
   });
   server.listen(0, "127.0.0.1");
   await once(server, "listening");
   const address = server.address();
   if (!address || typeof address === "string") throw new Error("No test port");
   try {
      await expect(
         smtpDelivery(`smtps://127.0.0.1:${address.port}`)(
            message,
            new AbortController().signal
         )
      ).rejects.toThrow(/self.signed|certificate/i);
   } finally {
      for (const peer of peers) peer.destroy();
      server.close();
   }
});
