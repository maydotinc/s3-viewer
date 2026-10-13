import { render } from "@react-email/render";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { PRODUCT_NAME, type Role } from "@s3-viewer/types";
import {
   AccountDeletedEmail,
   accountDeletedEmailSubject,
   accountDeletedEmailText,
   type AccountDeletedEmailProps,
} from "@s3-viewer/ui/emails/account-deleted";
import {
   PasswordResetEmail,
   passwordResetEmailSubject,
   passwordResetEmailText,
   type PasswordResetEmailProps,
} from "@s3-viewer/ui/emails/password-reset";
import {
   ServerInviteEmail,
   serverInviteEmailSubject,
   serverInviteEmailText,
   type ServerInviteEmailProps,
} from "@s3-viewer/ui/emails/server-invite";
import {
   VerificationCodeEmail,
   verificationCodeEmailSubject,
   verificationCodeEmailText,
   type VerificationCodeEmailProps,
} from "@s3-viewer/ui/emails/verification-code";
import {
   deliverEmail,
   resendDelivery,
   smtpDelivery,
   type Delivery,
} from "./delivery";
import type { EmailTransportName } from "./transport";

type MessageKind = "code" | "reset" | "invite" | "account-deleted";

type Message = {
   kind: MessageKind;
   to: string;
   subject: string;
   html: Parameters<typeof render>[0];
   text: string;
};

type Transport = (message: Message) => Promise<void>;

type EmailConfig = {
   transport: EmailTransportName;
   from?: string | undefined;
   resendKey?: string | undefined;
   smtpUrl?: string | undefined;
   // log whole messages (including their links) when nothing is sent, so a developer can follow them.
   logBodies: boolean;
};

const DEV_FROM = `${PRODUCT_NAME} <dev@localhost>`;

const deliveringTransport = (deliver: Delivery, from: string): Transport => {
   return async ({ kind, to, subject, html, text }) => {
      // a lost code or reset link locks the person out, so only those are retried.
      const retry = kind === "code" || kind === "reset";
      await deliverEmail(
         deliver,
         { from, to, subject, html: await render(html), text },
         { lane: kind === "invite" ? "invite" : "account", retry }
      );
   };
};

const noneTransport =
   (logBodies: boolean): Transport =>
   async ({ kind, to, subject, text }) => {
      console.info(
         logBodies
            ? `[email] to=${to} subject="${subject}" (transport none, not sent)\n${text}`
            : `[email] ${kind} email dropped (transport none)`
      );
   };

const buildTransport = (config: EmailConfig): Transport => {
   const from = config.from ?? DEV_FROM;
   if (config.transport === "resend")
      return deliveringTransport(resendDelivery(config.resendKey ?? ""), from);
   if (config.transport === "smtp")
      return deliveringTransport(smtpDelivery(config.smtpUrl ?? ""), from);
   return noneTransport(config.logBodies);
};

let configured: Transport | undefined;

const configureEmail = (config: EmailConfig): void => {
   configured = buildTransport(config);
};

const send: Transport = (message) => {
   if (!configured) {
      throw new Error("Email is not configured: call configureEmail() first");
   }
   return configured(message);
};

type SendVerificationCodeEmailInput = VerificationCodeEmailProps & {
   to: string;
};

const sendVerificationCodeEmail = async ({
   to,
   ...props
}: SendVerificationCodeEmailInput): Promise<void> => {
   await send({
      kind: "code",
      to,
      subject: verificationCodeEmailSubject(props.code),
      html: VerificationCodeEmail(props),
      text: verificationCodeEmailText(props),
   });
};

type SendPasswordResetEmailInput = PasswordResetEmailProps & { to: string };

const sendPasswordResetEmail = async ({
   to,
   ...props
}: SendPasswordResetEmailInput): Promise<void> => {
   await send({
      kind: "reset",
      to,
      subject: passwordResetEmailSubject(),
      html: PasswordResetEmail(props),
      text: passwordResetEmailText(props),
   });
};

type SendServerInviteEmailInput = {
   to: string;
   inviterName: string;
   inviterEmail: string;
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
   role,
   expiresAt,
   ...rest
}: SendServerInviteEmailInput): Promise<void> => {
   const props: ServerInviteEmailProps = {
      ...rest,
      roleLabel: ROLE_LABELS[role],
      expiresAtLabel: `on ${expiryFormatter.format(expiresAt)}`,
   };
   await send({
      kind: "invite",
      to,
      subject: serverInviteEmailSubject(),
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
      kind: "account-deleted",
      to,
      subject: accountDeletedEmailSubject(),
      html: AccountDeletedEmail(props),
      text: accountDeletedEmailText(props),
   });
};

export {
   configureEmail,
   sendAccountDeletedEmail,
   sendPasswordResetEmail,
   sendServerInviteEmail,
   sendVerificationCodeEmail,
};
