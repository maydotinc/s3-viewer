import { logger } from "@/lib/logger";
import { ensureDataDirSecrets } from "@/lib/utils/secrets";
import { resolveEmailTransport } from "@s3-viewer/email/transport";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();
ensureDataDirSecrets();

const optionalString = z
   .string()
   .trim()
   .optional()
   .transform((value) => value || undefined);

const isSmtpUrl = (value: string): boolean => {
   try {
      return ["smtp:", "smtps:"].includes(new URL(value).protocol);
   } catch {
      return false;
   }
};

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const DEFAULT_MAX_UPLOAD_BYTES = 5 * GIB;
const DEFAULT_UPLOAD_PART_BYTES = 25 * MIB;
const MIN_UPLOAD_PART_BYTES = 5 * MIB;
const MAX_UPLOAD_PART_BYTES = 5 * 1024 * MIB;

const schema = z
   .object({
      NODE_ENV: z
         .enum(["development", "test", "production"])
         .default("development"),
      DATABASE_URL: z.string().min(1),
      BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
      ENCRYPTION_PRIVATE_KEY: z.string().min(1),
      NEXT_PUBLIC_SITE_URL: z.string().url(),
      NEXT_PUBLIC_API_URL: z.string().url(),
      EMAIL_TRANSPORT: optionalString.pipe(
         z.enum(["none", "resend", "smtp"]).optional()
      ),
      SMTP_URL: optionalString,
      RESEND_KEY: optionalString,
      EMAIL_FROM: optionalString,
      SUPPORT_EMAIL: optionalString,
      GITHUB_CLIENT_ID: optionalString,
      GITHUB_CLIENT_SECRET: optionalString,
      PORT: z.coerce.number().int().min(1).max(65535).default(5001),
      MAX_UPLOAD_BYTES: optionalString
         .pipe(z.coerce.number().int().positive().optional())
         .transform((value) => value ?? DEFAULT_MAX_UPLOAD_BYTES),
      UPLOAD_PART_BYTES: optionalString
         .pipe(
            z.coerce
               .number()
               .int()
               .min(
                  MIN_UPLOAD_PART_BYTES,
                  `must be at least ${MIN_UPLOAD_PART_BYTES} bytes (S3's minimum part size)`
               )
               .max(
                  MAX_UPLOAD_PART_BYTES,
                  `must be at most ${MAX_UPLOAD_PART_BYTES} bytes`
               )
               .optional()
         )
         .transform((value) => value ?? DEFAULT_UPLOAD_PART_BYTES),
      TRUST_PROXY: z
         .string()
         .trim()
         .default("loopback")
         .transform((value) => (/^\d+$/.test(value) ? Number(value) : value)),
      LOG_LEVEL: optionalString.pipe(
         z.enum(["debug", "info", "warn", "error"]).optional()
      ),
      ALLOW_PRIVATE_ENDPOINTS: optionalString.transform(
         (value) => value === "true"
      ),
   })
   .superRefine((value, ctx) => {
      // an unset transport is inferred from whichever credential is present,
      // so only an explicit choice can name one it has nothing to connect with
      if (value.EMAIL_TRANSPORT === "smtp" && !value.SMTP_URL) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["SMTP_URL"],
            message: "required when EMAIL_TRANSPORT is `smtp`",
         });
      }
      if (value.EMAIL_TRANSPORT === "resend" && !value.RESEND_KEY) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["RESEND_KEY"],
            message: "required when EMAIL_TRANSPORT is `resend`",
         });
      }
      if (value.SMTP_URL && !isSmtpUrl(value.SMTP_URL)) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["SMTP_URL"],
            message:
               "must be an smtp:// or smtps:// URL, e.g. smtp://user:pass@mail.example.com:587",
         });
      }
      if (
         Boolean(value.GITHUB_CLIENT_ID) !== Boolean(value.GITHUB_CLIENT_SECRET)
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["GITHUB_CLIENT_SECRET"],
            message:
               "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set together",
         });
      }
   });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
   const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
   throw new Error(`Invalid environment: ${problems}`);
}

const env = {
   ...parsed.data,
   EMAIL_TRANSPORT: resolveEmailTransport(parsed.data),
};
const siteOrigin = new URL(env.NEXT_PUBLIC_SITE_URL).origin;

if (env.ALLOW_PRIVATE_ENDPOINTS) {
   logger.warn(
      "[security] ALLOW_PRIVATE_ENDPOINTS=true: S3 endpoints on private networks are accepted; only enable this on a trusted network"
   );
}

export { env, MAX_UPLOAD_PART_BYTES, siteOrigin };
