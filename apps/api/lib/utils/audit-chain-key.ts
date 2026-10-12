import { z } from "zod";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

// Buffer.from silently drops non-base64 characters and permits empty HMAC keys.
const auditChainKeySchema = z
   .string()
   .regex(
      BASE64_PATTERN,
      "must be base64 — generate one with `openssl rand -base64 32`"
   )
   .refine(
      (value) => Buffer.from(value, "base64").length >= 32,
      "must decode to at least 32 bytes — generate one with `openssl rand -base64 32`"
   );

export { BASE64_PATTERN, auditChainKeySchema };
