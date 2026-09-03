import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalString = z
   .string()
   .trim()
   .optional()
   .transform((value) => value || undefined);

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
      RESEND_KEY: optionalString,
      EMAIL_FROM: optionalString,
      GITHUB_CLIENT_ID: optionalString,
      GITHUB_CLIENT_SECRET: optionalString,
      PORT: z.coerce.number().int().min(1).max(65535).default(5001),
      MAX_UPLOAD_BYTES: optionalString.pipe(
         z.coerce.number().int().positive().optional()
      ),
      TRUST_PROXY: z
         .string()
         .trim()
         .default("loopback")
         .transform((value) => (/^\d+$/.test(value) ? Number(value) : value)),
   })
   .superRefine((value, ctx) => {
      if (value.NODE_ENV === "production" && !value.RESEND_KEY) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["RESEND_KEY"],
            message:
               "required in production (sign-in emails cannot be printed to the log)",
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

const env = parsed.data;
const siteOrigin = new URL(env.NEXT_PUBLIC_SITE_URL).origin;
const isProduction = env.NODE_ENV === "production";

export { env, isProduction, siteOrigin };
