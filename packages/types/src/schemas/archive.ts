import { z } from "zod";
import {
   ARCHIVE_TOKEN_MAX_CHARS,
   MAX_BATCH_KEYS,
   MINUTE_MS,
} from "../constants";
import { existingObjectKeySchema, expectedUserShape } from "./primitives";
import { bucketScope, uniqueKeys } from "./s3";

export const ARCHIVE_TOKEN_TTL_MS = 5 * MINUTE_MS;

export const archiveRequestBodySchema = bucketScope.extend({
   ...expectedUserShape,
   objectKeys: z
      .array(existingObjectKeySchema)
      .min(1)
      .max(MAX_BATCH_KEYS)
      .refine(...uniqueKeys((key: string) => key, "Object keys")),
});

const archiveTokenSchema = z
   .string()
   .regex(new RegExp(`^[A-Za-z0-9_.-]{22,${ARCHIVE_TOKEN_MAX_CHARS}}$`));

export const archiveDownloadParamsSchema = bucketScope.extend({
   token: archiveTokenSchema,
});

export type S3ArchiveTicket = {
   token: string;
   expiresAt: string;
   filename: string;
};
