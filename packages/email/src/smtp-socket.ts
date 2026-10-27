import { createConnection, isIP, type Socket } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { SMTPTransportOptions } from "nodemailer/lib/smtp-transport";

const parseSmtpProxy = (proxy: string): URL => {
   const url = new URL(proxy);
   if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("SMTP proxy must use HTTP or HTTPS");
   return url;
};

const smtpSocket = async (
   options: SMTPTransportOptions,
   proxy: string | undefined,
   signal: AbortSignal
): Promise<Socket> => {
   signal.throwIfAborted();
   const host = options.host || "localhost";
   const port = Number(options.port) || (options.secure ? 465 : 587);
   if (!proxy) {
      return new Promise((resolve, reject) => {
         const socket = createConnection({
            host,
            port,
            ...(options.localAddress && { localAddress: options.localAddress }),
            signal,
         });
         socket.once("error", reject);
         socket.once("connect", () => resolve(socket));
      });
   }
   const url = parseSmtpProxy(proxy);
   const authority = `${host.includes(":") ? `[${host}]` : host}:${port}`;
   const authorization =
      url.username || url.password
         ? Buffer.from(
              `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`
           ).toString("base64")
         : undefined;
   url.username = "";
   url.password = "";
   const proxyHost = url.hostname.replace(/^\[|\]$/g, "");
   return new Promise((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
         url,
         {
            rejectUnauthorized: options.tls?.rejectUnauthorized,
            servername: isIP(proxyHost) ? "" : proxyHost,
            method: "CONNECT",
            path: authority,
            headers: {
               Host: authority,
               ...(authorization && {
                  "Proxy-Authorization": `Basic ${authorization}`,
               }),
            },
            signal,
            agent: false,
         }
      );
      request.once("error", reject);
      request.once("connect", (response, socket, head) => {
         const status = response.statusCode ?? 0;
         if (status < 200 || status >= 300 || signal.aborted) {
            socket.destroy();
            // ECONNECTION marks it transient for delivery retries.
            reject(
               Object.assign(new Error("SMTP proxy connection failed"), {
                  code: "ECONNECTION",
               })
            );
            return;
         }
         // CONNECT detaches the socket from the request's abort handling.
         const abort = () =>
            socket.destroy(new Error("Email delivery timed out"));
         socket.on("error", () => {});
         signal.addEventListener("abort", abort, { once: true });
         socket.once("close", () => signal.removeEventListener("abort", abort));
         if (head.length) socket.unshift(head);
         resolve(socket);
      });
      request.end();
   });
};

export { parseSmtpProxy, smtpSocket };
