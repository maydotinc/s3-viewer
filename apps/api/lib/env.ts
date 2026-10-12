import {
   STREAM_IDLE_TIMEOUT_MS,
   UPLOAD_BUFFERS_PER_UPLOAD,
   uploadMemoryFor,
} from "./constants";
import { logger } from "./logger";
import { partSizeFor } from "@/lib/s3/part-size";
import { auditChainKeySchema } from "@/lib/utils/audit-chain-key";
import { ensureDataDirSecrets } from "@/lib/utils/secrets";
import {
   EMAIL_TRANSPORTS,
   resolveEmailTransport,
} from "@s3-viewer/email/transport";
import {
   GIB,
   HOUR_MS,
   MAX_OBJECT_BYTES,
   MIB,
   MINUTE_MS,
} from "@s3-viewer/types";
import {
   deriveSharedEnv,
   optionalString,
   parseEnv,
   refineSharedEnv,
   sharedEnvShape,
   withDefault,
} from "@s3-viewer/types/env";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();
ensureDataDirSecrets();

const isSmtpUrl = (value: string): boolean => {
   try {
      return ["smtp:", "smtps:"].includes(new URL(value).protocol);
   } catch {
      return false;
   }
};

const DEFAULT_MAX_UPLOAD_BYTES = 5 * GIB;
const DEFAULT_UPLOAD_PART_BYTES = 5 * MIB;
const MIN_UPLOAD_PART_BYTES = 5 * MIB;
const MAX_UPLOAD_PART_BYTES = 5 * 1024 * MIB;

const positiveInt = (fallback: number) =>
   withDefault(z.coerce.number().int().positive(), fallback);

const nonNegativeInt = (fallback: number) =>
   withDefault(z.coerce.number().int().min(0), fallback);

const flag = optionalString.transform((value) => value === "true");

const schema = z
   .object({
      NODE_ENV: z
         .enum(["development", "test", "production"])
         .default("development"),
      DATABASE_URL: z.string().min(1),
      ...sharedEnvShape,
      ENCRYPTION_PRIVATE_KEY: z.string().min(1),
      AUDIT_CHAIN_KEY: optionalString.pipe(auditChainKeySchema.optional()),
      EMAIL_TRANSPORT: optionalString.pipe(z.enum(EMAIL_TRANSPORTS).optional()),
      SMTP_URL: optionalString,
      RESEND_KEY: optionalString,
      EMAIL_FROM: optionalString,
      SUPPORT_EMAIL: optionalString,
      PORT: z.coerce.number().int().min(1).max(65535).default(5001),
      MAX_CONCURRENT_UPLOADS: positiveInt(6),
      MAX_USER_UPLOADS: positiveInt(3),
      MAX_IP_UPLOADS: positiveInt(2),
      // 5 GiB at the 128 KiB/s upload floor takes 11.4 h and a 10 GiB zip at the 32 KiB/s drain floor 91 h, so no cap
      // short of days fits a client held to the floors; 2 h already asks 5 GiB for ~745 KiB/s, and lowering it would
      // fail uploads that work today. slot abuse is bounded by those floors, per-server fair share and size-based lifetimes.
      UPLOAD_SLOT_MAX_MS: positiveInt(2 * HOUR_MS),
      UPLOAD_MEMORY_BUDGET_BYTES: positiveInt(256 * MIB),
      UPLOAD_IDLE_TIMEOUT_MS: positiveInt(STREAM_IDLE_TIMEOUT_MS),
      // must exceed any load balancer's idle timeout, or it reuses sockets Node closed (502s).
      KEEP_ALIVE_TIMEOUT_MS: positiveInt(65_000),
      S3_MAX_SOCKETS_PER_HOST: positiveInt(100),
      S3_MAX_TOTAL_SOCKETS: positiveInt(1000),
      S3_REQUESTS_PER_MINUTE: positiveInt(12_000),
      S3_MAX_INFLIGHT_PER_SERVER: positiveInt(32),
      S3_MAX_INFLIGHT_PER_USER: positiveInt(64),
      // must outlast a 5 GiB copy commit (~640 s) and an UploadPart moving a 64 MiB part at the storage floor (~1024 s).
      S3_REQUEST_TIMEOUT_MS: positiveInt(20 * MINUTE_MS),
      AUDIT_RETENTION_DAYS: nonNegativeInt(0),
      AUDIT_RETENTION_MIN_DAYS: positiveInt(90),
      UNVERIFIED_ACCOUNT_TTL_DAYS: nonNegativeInt(7),
      MAX_UPLOAD_BYTES: positiveInt(DEFAULT_MAX_UPLOAD_BYTES),
      UPLOAD_PART_BYTES: withDefault(
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
            ),
         DEFAULT_UPLOAD_PART_BYTES
      ),
      MAX_ARCHIVE_OBJECTS: positiveInt(10_000),
      MAX_ARCHIVE_BYTES: positiveInt(10 * GIB),
      TRUST_PROXY: z
         .string()
         .trim()
         .optional()
         .transform((raw) => {
            const value = raw || "loopback";
            if (/^\d+$/.test(value)) return Number(value);
            if (value === "true" || value === "false") return value === "true";
            return value;
         }),
      ALLOW_PRIVATE_ENDPOINTS: flag,
      ACCEPT_NEW_ENCRYPTION_KEY: flag,
      ACCEPT_NEW_AUDIT_CHAIN_KEY: flag,
   })
   .superRefine((value, ctx) => {
      refineSharedEnv(value, ctx);
      if (value.NODE_ENV === "production" && value.TRUST_PROXY === true) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["TRUST_PROXY"],
            message:
               "`true` trusts any client-supplied X-Forwarded-For, so every per-IP limit can be spoofed; set the number of proxy hops (e.g. 1) or a CIDR list instead",
         });
      }
      const largestPart = partSizeFor(
         Math.min(value.MAX_UPLOAD_BYTES, MAX_OBJECT_BYTES),
         value.UPLOAD_PART_BYTES
      );
      if (uploadMemoryFor(largestPart) >= value.UPLOAD_MEMORY_BUDGET_BYTES) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["UPLOAD_MEMORY_BUDGET_BYTES"],
            message: `must hold more than ${UPLOAD_BUFFERS_PER_UPLOAD} buffers of ${largestPart} bytes, the largest part an upload of MAX_UPLOAD_BYTES needs`,
         });
      }
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
      if (
         value.NODE_ENV === "production" &&
         !value.EMAIL_FROM &&
         resolveEmailTransport(value) !== "none"
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["EMAIL_FROM"],
            message:
               "required in production when email is enabled: there is no default sender",
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
   });

const parsed = parseEnv(schema, process.env);

const env = {
   ...parsed,
   EMAIL_TRANSPORT: resolveEmailTransport(parsed),
};
const { siteOrigin } = deriveSharedEnv(env);
const MAX_UPLOAD_OBJECT_BYTES = Math.min(
   env.MAX_UPLOAD_BYTES,
   MAX_OBJECT_BYTES
);

if (env.ALLOW_PRIVATE_ENDPOINTS) {
   logger.warn(
      "[security] ALLOW_PRIVATE_ENDPOINTS=true: S3 endpoints on private networks are accepted; only enable this on a trusted network"
   );
}

if (env.NODE_ENV === "production" && env.RATE_LIMIT_STORE === "memory") {
   logger.warn(
      "[security] RATE_LIMIT_STORE=memory in production: sign-in, sign-up, connect and invite rate limits are per replica, not shared. Set RATE_LIMIT_STORE=postgres unless this is a single-replica deployment."
   );
}

export { MAX_UPLOAD_OBJECT_BYTES, env, siteOrigin };
