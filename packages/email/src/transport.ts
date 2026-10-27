const EMAIL_TRANSPORTS = ["none", "resend", "smtp"] as const;

type EmailTransportName = (typeof EMAIL_TRANSPORTS)[number];

type EmailTransportEnv = {
   EMAIL_TRANSPORT?: string | undefined;
   RESEND_KEY?: string | undefined;
   SMTP_URL?: string | undefined;
};

const isTransportName = (value: string): value is EmailTransportName =>
   (EMAIL_TRANSPORTS as readonly string[]).includes(value);

const resolveEmailTransport = (env: EmailTransportEnv): EmailTransportName => {
   const explicit = env.EMAIL_TRANSPORT?.trim() ?? "";
   if (isTransportName(explicit)) return explicit;
   if (env.RESEND_KEY?.trim()) return "resend";
   if (env.SMTP_URL?.trim()) return "smtp";
   return "none";
};

export { EMAIL_TRANSPORTS, resolveEmailTransport };
export type { EmailTransportName };
