import { render } from "@react-email/render";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { PRODUCT_NAME, type Role } from "@s3-viewer/types";
import {
   AccountDeletedEmail,
   accountDeletedEmailText,
   type AccountDeletedEmailProps,
} from "@s3-viewer/ui/emails/account-deleted";
import {
   AuthCodeEmail,
   authCodeEmailSubject,
   authCodeEmailText,
   type AuthCodeEmailProps,
} from "@s3-viewer/ui/emails/auth-code";
import {
   AuthOtpEmail,
   authOtpEmailText,
   type AuthOtpEmailProps,
} from "@s3-viewer/ui/emails/auth-otp";
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
   html: ReturnType<typeof AuthOtpEmail>;
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

// no transport configured: mail is written to the log instead of sent. The
// api refuses to start this way in production when a sign-in code would be
// the thing being logged (see apps/api/lib/env.ts); otherwise only invite and
// account notices land here, and the invite itself is still visible in-app
const consoleTransport = (): Transport => {
   console.warn(
      "[email] No mail transport configured (RESEND_KEY or SMTP_URL); email will be written to the log instead of sent"
   );
   return async ({ to, subject, text }) => {
      console.info(`[email] to=${to} subject="${subject}" (not sent)\n${text}`);
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

type SendAuthEmailInput = AuthOtpEmailProps & { to: string };

const sendAuthEmail = async ({
   to,
   ...props
}: SendAuthEmailInput): Promise<void> => {
   await send({
      to,
      subject: `Sign in to ${PRODUCT_NAME}`,
      html: AuthOtpEmail(props),
      text: authOtpEmailText(props),
   });
};

type SendAuthCodeEmailInput = AuthCodeEmailProps & { to: string };

const sendAuthCodeEmail = async ({
   to,
   ...props
}: SendAuthCodeEmailInput): Promise<void> => {
   await send({
      to,
      subject: authCodeEmailSubject(props.intent),
      html: AuthCodeEmail(props),
      text: authCodeEmailText(props),
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
   sendAccountDeletedEmail,
   sendAuthCodeEmail,
   sendAuthEmail,
   sendServerInviteEmail,
};
export type { AuthCodeIntent } from "@s3-viewer/ui/emails/auth-code";
