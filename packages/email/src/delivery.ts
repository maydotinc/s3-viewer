import type { Socket } from "node:net";
import { SECOND_MS } from "@s3-viewer/types";
import { createTransport } from "nodemailer";
import { parseConnectionUrl } from "nodemailer/lib/shared";
import { Resend, type CreateEmailRequestOptions } from "resend";
import { smtpSocket } from "./smtp-socket";

const EMAIL_TIMEOUT_MS = 10 * SECOND_MS;
const RETRY_DELAY_MS = 2 * SECOND_MS;

// separate pools so a burst of invites can't starve password-reset and verification links.
const LANE_CAPACITY = { account: 10, invite: 10 } as const;

type DeliveryLane = keyof typeof LANE_CAPACITY;

type DeliveryOptions = { lane: DeliveryLane; retry?: boolean };

class TransientEmailError extends Error {}

type EmailMessage = {
   from: string;
   to: string;
   subject: string;
   html: string;
   text: string;
};

type Delivery = (message: EmailMessage, signal: AbortSignal) => Promise<void>;

type ConnectionOptions = ReturnType<typeof parseConnectionUrl>;

// without requireTLS, a server omitting STARTTLS receives credentials and auth links in clear.
const requireTlsWithCredentials = (
   options: ConnectionOptions
): ConnectionOptions =>
   options.auth &&
   !options.secure &&
   options.requireTLS === undefined &&
   options.ignoreTLS === undefined
      ? { ...options, requireTLS: true }
      : options;

const smtpDelivery = (url: string): Delivery => {
   const { proxy, ...parsed } = parseConnectionUrl(url);
   if (proxy !== undefined && typeof proxy !== "string")
      throw new Error("SMTP proxy must be a URL");
   const options = requireTlsWithCredentials(parsed);
   return async (message, signal) => {
      signal.throwIfAborted();
      let socket: Socket | undefined;
      const mailer = createTransport({
         ...options,
         pool: false,
         connectionTimeout: EMAIL_TIMEOUT_MS,
         greetingTimeout: EMAIL_TIMEOUT_MS,
         socketTimeout: EMAIL_TIMEOUT_MS,
         dnsTimeout: EMAIL_TIMEOUT_MS,
         // own the socket so the total deadline also stops a trickling server.
         getSocket: (connection, callback) => {
            if (signal.aborted) {
               callback(new Error("Email delivery timed out"));
               return;
            }
            void smtpSocket(connection, proxy, signal).then((connected) => {
               socket = connected;
               if (signal.aborted) {
                  connected.destroy();
                  callback(new Error("Email delivery timed out"));
               } else callback(null, { connection: connected });
            }, callback);
         },
      });
      try {
         await mailer.sendMail(message);
         signal.throwIfAborted();
      } finally {
         socket?.destroy();
         mailer.close();
      }
   };
};

const RESEND_SERVER_ERRORS = new Set([
   "application_error",
   "internal_server_error",
]);

const resendDelivery = (apiKey: string): Delivery => {
   const resend = new Resend(apiKey);
   return async ({ to, ...message }, signal) => {
      signal.throwIfAborted();
      // the SDK forwards request options to fetch but omits signal in its type.
      const options: CreateEmailRequestOptions & { signal: AbortSignal } = {
         signal,
      };
      const { error } = await resend.emails.send(
         { ...message, to: [to] },
         options
      );
      signal.throwIfAborted();
      if (!error) return;
      const failure = `Email provider error: ${error.name}`;
      throw RESEND_SERVER_ERRORS.has(error.name)
         ? new TransientEmailError(failure)
         : new Error(failure);
   };
};

const SMTP_TIMEOUT_CODES = new Set(["ETIMEDOUT", "ETIMEOUT"]);

const isTransient = (error: unknown): boolean => {
   if (error instanceof TransientEmailError) return true;
   if (!(error instanceof Error)) return false;
   const { code, responseCode } = error as Error & {
      code?: unknown;
      responseCode?: unknown;
   };
   // SMTP 4xx replies are the temporary failures; SMTP 5xx are permanent.
   return (
      (typeof code === "string" && SMTP_TIMEOUT_CODES.has(code)) ||
      (typeof responseCode === "number" &&
         responseCode >= 400 &&
         responseCode < 500)
   );
};

const attempt = async (
   deliver: Delivery,
   message: EmailMessage
): Promise<void> => {
   const controller = new AbortController();
   const timer = setTimeout(
      () =>
         controller.abort(new TransientEmailError("Email delivery timed out")),
      EMAIL_TIMEOUT_MS
   );
   try {
      await deliver(message, controller.signal);
   } catch (error) {
      // a deliverer may surface its own error once aborted; the deadline is the real cause.
      throw controller.signal.aborted ? controller.signal.reason : error;
   } finally {
      clearTimeout(timer);
   }
};

const activeDeliveries: Record<DeliveryLane, number> = {
   account: 0,
   invite: 0,
};

const deliverEmail = async (
   deliver: Delivery,
   message: EmailMessage,
   { lane, retry = false }: DeliveryOptions
): Promise<void> => {
   if (activeDeliveries[lane] >= LANE_CAPACITY[lane]) {
      throw new Error("Email delivery is busy. Try again shortly.");
   }
   activeDeliveries[lane]++;
   try {
      try {
         await attempt(deliver, message);
      } catch (error) {
         if (!retry || !isTransient(error)) throw error;
         await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
         await attempt(deliver, message);
      }
   } finally {
      activeDeliveries[lane]--;
   }
};

export { deliverEmail, resendDelivery, smtpDelivery };
export type { Delivery, EmailMessage };
