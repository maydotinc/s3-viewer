import { execFile } from "node:child_process";
import { once } from "node:events";
import { createServer as createHttpsServer } from "node:https";
import { createServer, type Socket } from "node:net";
import type { Duplex } from "node:stream";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { smtpDelivery } from "./delivery";
import { smtpSocket } from "./smtp-socket";
import { tlsCertPath, tlsOptions } from "./testing/tls-fixture";

const message = {
   from: "sender@example.com",
   to: "recipient@example.com",
   subject: "Proxy fixture",
   html: "<p>Test</p>",
   text: "Test",
};

it.each(["connect", "smtp"])(
   "aborts the proxy during %s without leaving a live socket",
   async (phase) => {
      let peer: Socket | undefined;
      let ready!: () => void;
      const contacted = new Promise<void>((resolve) => {
         ready = resolve;
      });
      let headers = "";
      const proxy = createServer((socket) => {
         peer = socket;
         socket.on("error", () => {});
         socket.on("data", (data) => {
            headers += data.toString();
            if (!headers.includes("\r\n\r\n")) return;
            if (phase === "smtp")
               socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
            ready();
         });
      }).listen(0, "127.0.0.1");
      await once(proxy, "listening");
      const address = proxy.address();
      if (!address || typeof address === "string")
         throw new Error("No test port");
      const proxyUrl = `http://u%40example:p%3Ass@127.0.0.1:${address.port}`;
      const controller = new AbortController();
      const sending = smtpDelivery(
         `smtp://mail.example.test?proxy=${encodeURIComponent(proxyUrl)}`
      )(message, controller.signal);
      const rejection = expect(sending).rejects.toThrow();
      try {
         await contacted;
         if (phase === "smtp")
            await new Promise((resolve) => setImmediate(resolve));
         const closed = new Promise<void>((resolve) =>
            peer!.once("close", resolve)
         );
         controller.abort(new Error("Fixture deadline"));
         await rejection;
         await closed;
         expect(peer!.destroyed).toBe(true);
         expect(headers).toContain("CONNECT mail.example.test:587 HTTP/1.1");
         expect(headers.toLowerCase()).toContain(
            `proxy-authorization: basic ${Buffer.from("u@example:p:ss").toString("base64").toLowerCase()}`
         );
      } finally {
         peer?.destroy();
         proxy.close();
      }
   }
);

it("keeps a greeting received with the CONNECT response", async () => {
   let peer: Socket | undefined;
   const proxy = createServer((socket) => {
      peer = socket;
      socket.on("error", () => {});
      let buffered = "";
      let connected = false;
      socket.on("data", (data) => {
         buffered += data.toString();
         if (!connected) {
            const end = buffered.indexOf("\r\n\r\n");
            if (end === -1) return;
            connected = true;
            buffered = buffered.slice(end + 4);
            socket.write(
               `HTTP/1.1 200 Connection Established\r\n\r\n220 localhost SMTP\r\n`
            );
         }
         let end: number;
         while ((end = buffered.indexOf("\r\n")) !== -1) {
            const line = buffered.slice(0, end);
            buffered = buffered.slice(end + 2);
            if (line.startsWith("EHLO")) socket.write("250 localhost\r\n");
            else if (
               line.startsWith("MAIL FROM") ||
               line.startsWith("RCPT TO") ||
               line === "."
            )
               socket.write("250 OK\r\n");
            else if (line === "DATA") socket.write("354 Send message\r\n");
         }
      });
   }).listen(0, "127.0.0.1");
   await once(proxy, "listening");
   const address = proxy.address();
   if (!address || typeof address === "string") throw new Error("No test port");
   try {
      const proxyUrl = `http://127.0.0.1:${address.port}`;
      await expect(
         smtpDelivery(
            `smtp://mail.example.test:587?proxy=${encodeURIComponent(proxyUrl)}&ignoreTLS=true`
         )(message, AbortSignal.timeout(1000))
      ).resolves.toBeUndefined();
   } finally {
      peer?.destroy();
      proxy.close();
   }
});

it.each([undefined, "smtp.example.test"])(
   "isolates HTTPS proxy trust and hostname from SMTP TLS with servername %s",
   async (servername) => {
      let peer: Duplex | undefined;
      let authority: string | undefined;
      const proxy = createHttpsServer(tlsOptions).listen(0, "127.0.0.1");
      proxy.on("connect", (request, socket) => {
         peer = socket;
         authority = request.url;
         socket.on("error", () => {});
         socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      });
      await once(proxy, "listening");
      const address = proxy.address();
      if (!address || typeof address === "string")
         throw new Error("No test port");
      try {
         const source = `
            import { smtpSocket } from ${JSON.stringify(fileURLToPath(new URL("./smtp-socket.ts", import.meta.url)))};
            const socket = await smtpSocket(
               ${JSON.stringify({ host: "mail.example.test", tls: { ca: [], servername } })},
               ${JSON.stringify(`https://localhost:${address.port}`)},
               AbortSignal.timeout(1000)
            );
            if (!socket.authorized) throw new Error("Proxy certificate was not verified");
            socket.destroy();
         `;
         await promisify(execFile)(
            process.execPath,
            ["--import=tsx", "--input-type=module", "-e", source],
            {
               env: {
                  ...process.env,
                  NODE_EXTRA_CA_CERTS: tlsCertPath,
               },
               timeout: 5000,
            }
         );
         expect(authority).toBe("mail.example.test:587");
      } finally {
         peer?.destroy();
         proxy.close();
      }
   }
);

it("reports a refused CONNECT as a transient connection failure", async () => {
   const proxy = createServer((socket) => {
      socket.on("error", () => {});
      socket.once("data", () => socket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"));
   }).listen(0, "127.0.0.1");
   await once(proxy, "listening");
   const address = proxy.address();
   if (!address || typeof address === "string") throw new Error("No test port");
   try {
      await expect(
         smtpSocket(
            { host: "mail.example.test", port: 587 },
            `http://127.0.0.1:${address.port}`,
            new AbortController().signal
         )
      ).rejects.toMatchObject({ code: "ECONNECTION" });
   } finally {
      proxy.close();
   }
});
