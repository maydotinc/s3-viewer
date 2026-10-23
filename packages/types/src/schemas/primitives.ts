import { z } from "zod";
import { Role, type GrantableRole } from "../server-types";
import {
   MAX_GRANT_FOLDERS,
   canLimitToFolders,
   hasDotSegment,
   isDotSegment,
   normalizeFolders,
} from "../folder-scope";
import {
   DEFAULT_CONTENT_TYPE,
   MAX_EMAIL_LENGTH,
   PASSWORD_MAX_LENGTH,
   PASSWORD_MIN_LENGTH,
} from "../constants";
import { normalizeEmail } from "../utils";

export const idSchema = z.string().regex(/^[A-Za-z0-9]{8,64}$/, "Invalid id");

const isBucketNameShape = (value: string): boolean =>
   !/\.\.|\.-|-\./.test(value) && !/^\d+\.\d+\.\d+\.\d+$/.test(value);

export const bucketNameSchema = z
   .string()
   .min(3)
   .max(63)
   .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "Invalid bucket name")
   .refine(isBucketNameShape, "Invalid bucket name");

export const existingBucketNameSchema = z
   .string()
   .min(3)
   .max(255)
   .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]{1,253}[A-Za-z0-9]$/,
      "Invalid bucket name"
   )
   .refine(isBucketNameShape, "Invalid bucket name");

// eslint-disable-next-line no-control-regex -- rejecting control characters is the point of this pattern
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const LONE_SURROGATE = /\p{Surrogate}/u;

export const isDatabaseText = (value: string): boolean =>
   !value.includes("\0") && !LONE_SURROGATE.test(value);

export const isDatabaseDate = (value: Date): boolean => {
   const year = value.getUTCFullYear();
   return year >= 1 && year <= 9999;
};

export const isSafeKeyText = (value: string): boolean =>
   !value.startsWith("/") &&
   !CONTROL_CHARS.test(value) &&
   !LONE_SURROGATE.test(value);

// format characters (bidi overrides, zero-width marks) can reorder or hide text in a name shown to
// other people; a joiner stays allowed only inside an emoji sequence such as a family or flag.
const UNSAFE_DISPLAY_CHARS =
   /[\p{Cc}\p{Zl}\p{Zp}]|(?!\u200D)\p{Cf}|(?<![\p{Extended_Pictographic}\p{Emoji_Modifier}]\uFE0F?)\u200D|\u200D(?!\p{Extended_Pictographic})/u;

const isSafeDisplayText = (value: string): boolean =>
   !UNSAFE_DISPLAY_CHARS.test(value) && !LONE_SURROGATE.test(value);

const UNSAFE_DISPLAY_EACH = new RegExp(
   `${UNSAFE_DISPLAY_CHARS.source}|${LONE_SURROGATE.source}`,
   "gu"
);

/** swaps each character isSafeDisplayText rejects, for text that can't be refused at write time, such as keys already in storage. */
export const replaceUnsafeDisplayChars = (
   value: string,
   replace: (char: string) => string
): string => value.replace(UNSAFE_DISPLAY_EACH, replace);

const PLAIN_LABEL_MAX = 40;
const INVISIBLE_CHARS = /\p{Cf}/gu;
const BREAK_CHARS = /[\p{Cc}\p{Zl}\p{Zp}]/gu;
// a scheme, a www. host or a host followed by a path, query or fragment; bare names such as
// "Node.js" stay. U+3002 is the ideographic full stop, which URL parsers accept as a dot.
const URL_LIKE =
   /(?:https?:\/\/|www[.\u3002])\S+|[\p{L}\p{N}_-]+(?:[.\u3002][\p{L}\p{N}_-]+)*[.\u3002](?:\p{L}{2,}|xn--[\p{L}\p{N}-]+)(?![\p{L}\p{N}_-])(?::\d+)?[/?#]\S*/giu;

/** user-chosen names rendered where they look like our own words (emails): no links, addresses or hidden characters. */
export const plainLabel = (value: string, fallback: string): string => {
   const plain = value
      .normalize("NFKC")
      .replace(INVISIBLE_CHARS, "")
      .replace(BREAK_CHARS, " ")
      .replace(URL_LIKE, "[link]")
      .replaceAll("@", "[at]")
      .replace(/\s+/g, " ")
      .trim();
   const chars = Array.from(plain);
   if (chars.length === 0) return fallback;
   return chars.length > PLAIN_LABEL_MAX
      ? `${chars
           .slice(0, PLAIN_LABEL_MAX - 1)
           .join("")
           .trimEnd()}…`
      : plain;
};

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** one key per real inbox, so +tags and gmail dots can't multiply a per-recipient budget. */
export const canonicalMailbox = (email: string): string => {
   const address = normalizeEmail(email);
   const at = address.lastIndexOf("@");
   if (at <= 0) return address;
   const domain = address.slice(at + 1);
   const local = address.slice(0, at).split("+")[0] || address.slice(0, at);
   return GMAIL_DOMAINS.has(domain)
      ? `${local.replaceAll(".", "")}@gmail.com`
      : `${local}@${domain}`;
};

const MAX_OBJECT_KEY_BYTES = 1024;
export const PROFILE_NAME_MAX = 80;
export const SERVER_NAME_MAX = 64;

export const utf8ByteLength = (value: string): number =>
   new TextEncoder().encode(value).length;

export const existingPrefixSchema = z
   .string()
   .refine(
      (value) =>
         !LONE_SURROGATE.test(value) &&
         utf8ByteLength(value) <= MAX_OBJECT_KEY_BYTES,
      `Keys must be valid Unicode and at most ${MAX_OBJECT_KEY_BYTES} UTF-8 bytes`
   );

export const existingObjectKeySchema = z
   .string()
   .min(1)
   .pipe(existingPrefixSchema);

export const objectKeySchema = existingObjectKeySchema.refine(
   (k) =>
      isSafeKeyText(k) &&
      k.split("/").every((seg, i, arr) => {
         const last = i === arr.length - 1;
         if (seg === "") return last;
         return !isDotSegment(seg);
      }),
   "Invalid object key"
);

export const fileKeySchema = objectKeySchema.refine(
   (key) => !key.endsWith("/"),
   "File keys cannot end with /"
);

export const profileNameSchema = z
   .string()
   .trim()
   .min(1)
   .max(PROFILE_NAME_MAX)
   .refine(isSafeDisplayText, "Invalid name");

const MEDIA_TYPE =
   /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+(?:;[ -~]*)?$/;
export const contentTypeSchema = z
   .string()
   .trim()
   .max(255)
   .transform((v) => v || DEFAULT_CONTENT_TYPE)
   .pipe(z.string().regex(MEDIA_TYPE, "Invalid content type"));

export const serverNameSchema = z
   .string()
   .trim()
   .min(1, "Enter a server name")
   .max(
      SERVER_NAME_MAX,
      `Server name must be ${SERVER_NAME_MAX} characters or fewer`
   )
   .refine(isSafeDisplayText, "Invalid server name");
export const encryptedCredentialsSchema = z.string().min(1).max(65_536);
export const emailSchema = z
   .string()
   .trim()
   .toLowerCase()
   .email()
   .max(MAX_EMAIL_LENGTH);
export const passwordSchema = z
   .string()
   .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
   .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const roleSchema = z.nativeEnum(Role);

export const grantableRoleSchema = roleSchema.refine(
   (role): role is GrantableRole => role !== Role.OWNER,
   "Owners can't be granted"
);

export const grantFolderSchema = objectKeySchema
   .refine((key) => key.endsWith("/"), "Folders must end with /")
   .refine((key) => !hasDotSegment(key), "Invalid folder");

// required and nullable: an older client omitting it must not widen a limited grant.
const grantFoldersSchema = z
   .array(grantFolderSchema)
   .min(1, "Pick at least one folder, or grant the whole bucket")
   .max(MAX_GRANT_FOLDERS, `Pick at most ${MAX_GRANT_FOLDERS} folders`)
   .transform(normalizeFolders)
   .nullable();

export const bucketAccessEntrySchema = z
   .object({
      bucketName: existingBucketNameSchema,
      role: grantableRoleSchema,
      folders: grantFoldersSchema,
   })
   .refine(({ role, folders }) => folders === null || canLimitToFolders(role), {
      message: "Admins always get the whole bucket",
      path: ["folders"],
   });

export const expectedUserShape = { expectedUserId: idSchema };

export const MAX_BUCKET_NAMES = 100;
export const bucketNameListSchema = z
   .array(existingBucketNameSchema)
   .max(MAX_BUCKET_NAMES)
   .transform((names) => [...new Set(names)]);
