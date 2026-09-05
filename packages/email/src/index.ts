import { render } from "@react-email/render";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { PRODUCT_NAME, type Role } from "@s3-viewer/types";
import {
   AccountDeletedEmail,
   accountDeletedEmailText,
   type AccountDeletedEmailProps,
} from "@s3-viewer/ui/emails/account-deleted";
import {
   AuthLinkEmail,
   authLinkEmailSubject,
   authLinkEmailText,
   type AuthLinkEmailProps,
} from "@s3-viewer/ui/emails/auth-link";
import {
   ServerInviteEmail,
   serverInviteEmailText,
   type ServerInviteEmailProps,
} from "@s3-viewer/ui/emails/server-invite";
import { createTransport } from "nodemailer";
import { Resend } from "resend";
import { resolveEmailTransport, type EmailTransportName } from "./transport";

type Message = {
   to: string;
   subject: string;
   html: ReturnType<typeof AuthLinkEmail>;
   text: string;
};

type Transport = (message: Message) => Promise<void>;

const DEV_FROM = `${PRODUCT_NAME} <dev@localhost>`;

const resolveFrom = (): string => {
   if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
   if (process.env.NODE_ENV === "production") {
      throw new Error(
         "EMAIL_FROM is required in production (there is no default sender — " +
            "self-hosters must not send mail claiming to be from May Inc.)"
      );
   }
   return DEV_FROM;
};

const resendTransport = (apiKey: string): Transport => {
   const resend = new Resend(apiKey);
   const from = resolveFrom();
   return async ({ to, subject, html, text }) => {
      const { error } = await resend.emails.send({
         from,
         to: [to],
         subject,
         react: html,
         text,
      });
      if (error) throw new Error(`Email provider error: ${error.name}`);
   };
};

const smtpTransport = (url: string): Transport => {
   const mailer = createTransport(url);
   const from = resolveFrom();
   return async ({ to, subject, html, text }) => {
      await mailer.sendMail({
         from,
         to,
         subject,
         html: await render(html),
         text,
      });
   };
};

// no transport. In development the whole message is written to the log, which
// is how a verification or reset link is picked up locally. In production the
// body is never logged — a reset link in a log file would be an account
// takeover for anyone who can read logs — so the message is dropped and only
// its envelope recorded
const noneTransport = (): Transport => {
   const production = process.env.NODE_ENV === "production";
   return async ({ to, subject, text }) => {
      console.info(
         production
            ? `[email] to=${to} subject="${subject}" (transport none, dropped)`
            : `[email] to=${to} subject="${subject}" (transport none, not sent)\n${text}`
      );
   };
};

const BOOT_LINE: Record<EmailTransportName, string> = {
   none: "[email] transport: none — password reset, email verification and invites are unavailable on this instance",
   resend: "[email] transport: resend",
   smtp: "[email] transport: smtp",
};

const required = (name: string, transport: EmailTransportName): string => {
   const value = process.env[name]?.trim();
   if (!value) {
      throw new Error(
         `${name} is required when EMAIL_TRANSPORT is \`${transport}\``
      );
   }
   return value;
};

const buildTransport = (transport: EmailTransportName): Transport => {
   if (transport === "resend") {
      return resendTransport(required("RESEND_KEY", transport));
   }
   if (transport === "smtp")
      return smtpTransport(required("SMTP_URL", transport));
   return noneTransport();
};

const transport = resolveEmailTransport(process.env);
const emailEnabled = transport !== "none";

(emailEnabled ? console.info : console.warn)(BOOT_LINE[transport]);

const send: Transport = buildTransport(transport);

type SendAuthLinkEmailInput = AuthLinkEmailProps & { to: string };

const sendAuthLinkEmail = async ({
   to,
   ...props
}: SendAuthLinkEmailInput): Promise<void> => {
   await send({
      to,
      subject: authLinkEmailSubject(props.intent),
      html: AuthLinkEmail(props),
      text: authLinkEmailText(props),
   });
};

type SendServerInviteEmailInput = {
   to: string;
   inviterName: string;
   serverName: string;
   role: Role;
   expiresAt: Date;
   invitesUrl: string;
};

const expiryFormatter = new Intl.DateTimeFormat("en-US", {
   month: "long",
   day: "numeric",
   year: "numeric",
   timeZone: "UTC",
});

const sendServerInviteEmail = async ({
   to,
   inviterName,
   serverName,
   role,
   expiresAt,
   invitesUrl,
}: SendServerInviteEmailInput): Promise<void> => {
   const props: ServerInviteEmailProps = {
      inviterName,
      serverName,
      roleLabel: ROLE_LABELS[role],
      invitesUrl,
      expiresAtLabel: `on ${expiryFormatter.format(expiresAt)}`,
   };
   await send({
      to,
      subject: `${inviterName} invited you to ${serverName} on ${PRODUCT_NAME}`,
      html: ServerInviteEmail(props),
      text: serverInviteEmailText(props),
   });
};

type SendAccountDeletedEmailInput = AccountDeletedEmailProps & { to: string };

const sendAccountDeletedEmail = async ({
   to,
   ...props
}: SendAccountDeletedEmailInput): Promise<void> => {
   await send({
      to,
      subject: `Your ${PRODUCT_NAME} account has been deleted`,
      html: AccountDeletedEmail(props),
      text: accountDeletedEmailText(props),
   });
};

export {
   emailEnabled,
   sendAccountDeletedEmail,
   sendAuthLinkEmail,
   sendServerInviteEmail,
};
export { resolveEmailTransport } from "./transport";
export type { EmailTransportName } from "./transport";
