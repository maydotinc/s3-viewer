import { z } from "zod";
import {
   DEFAULT_CONTENT_TYPE,
   PASSWORD_MAX_LENGTH,
   PASSWORD_MIN_LENGTH,
} from "../constants";

export const idSchema = z.string().regex(/^[A-Za-z0-9]{8,64}$/, "Invalid id");

export const bucketNameSchema = z
   .string()
   .min(3)
   .max(63)
   .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "Invalid bucket name")
   .refine(
      (v) => !/\.\.|\.-|-\./.test(v) && !/^\d+\.\d+\.\d+\.\d+$/.test(v),
      "Invalid bucket name"
   );

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export const objectKeySchema = z
   .string()
   .min(1)
   .max(1024)
   .refine(
      (k) =>
         !k.startsWith("/") &&
         !CONTROL_CHARS.test(k) &&
         k.split("/").every((seg, i, arr) => {
            const last = i === arr.length - 1;
            if (seg === "") return last;
            return seg !== "." && seg !== "..";
         }),
      "Invalid object key"
   );

const MEDIA_TYPE =
   /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+(?:;[ -~]*)?$/;
export const contentTypeSchema = z
   .string()
   .trim()
   .max(255)
   .transform((v) => v || DEFAULT_CONTENT_TYPE)
   .pipe(z.string().regex(MEDIA_TYPE, "Invalid content type"));

export const serverNameSchema = z.string().trim().min(1).max(64);
export const encryptedCredentialsSchema = z.string().min(1).max(8192);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
   .string()
   .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
   .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const grantableRoleSchema = z.enum(["ADMIN", "EDITOR", "VIEWER"]);

export const bucketAccessEntrySchema = z.object({
   bucketName: bucketNameSchema,
   role: grantableRoleSchema,
});

export const MAX_BUCKET_NAMES = 100;
export const bucketNameListSchema = z
   .array(bucketNameSchema)
   .max(MAX_BUCKET_NAMES)
   .transform((names) => [...new Set(names)]);
