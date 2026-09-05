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

const from = resolveFrom();

const resendTransport = (apiKey: string): Transport => {
   const resend = new Resend(apiKey);
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

// no transport configured. In development the whole message is written to
// the log, which is how a verification or reset link is picked up locally. In
// production the body is never logged — a reset link in a log file would be
// an account takeover for anyone who can read logs — so the message is
// dropped and only its envelope recorded
const consoleTransport = (): Transport => {
   const production = process.env.NODE_ENV === "production";
   console.warn(
      production
         ? "[email] No mail transport configured (RESEND_KEY or SMTP_URL): verification and password-reset links cannot be delivered, so invites stay unavailable and forgotten passwords cannot be recovered. Configure a transport."
         : "[email] No mail transport configured (RESEND_KEY or SMTP_URL); email will be written to the log instead of sent"
   );
   return async ({ to, subject, text }) => {
      console.info(
         production
            ? `[email] to=${to} subject="${subject}" (no transport, dropped)`
            : `[email] to=${to} subject="${subject}" (not sent)\n${text}`
      );
   };
};

const resolveTransport = (): Transport => {
   if (process.env.EMAIL_TRANSPORT === "smtp" && process.env.SMTP_URL) {
      return smtpTransport(process.env.SMTP_URL);
   }
   if (process.env.RESEND_KEY) return resendTransport(process.env.RESEND_KEY);
   return consoleTransport();
};

const send: Transport = resolveTransport();

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

export { sendAccountDeletedEmail, sendAuthLinkEmail, sendServerInviteEmail };
