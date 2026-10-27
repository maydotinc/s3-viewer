import type { S3Client } from "@aws-sdk/client-s3";
import { cloneS3Client, type CloneOptions } from "./clone-client";

const CLEANUP_MAX_ATTEMPTS = 3;

type Variant =
   | "once"
   | "cleanup"
   | "cancel"
   | "cancelOnce"
   | "unbudgeted"
   | "parts";
type Clone = { base: S3Client; variant: Variant };

const variants = new WeakMap<S3Client, Partial<Record<Variant, S3Client>>>();
const clones = new WeakMap<S3Client, Clone>();

const cachedClone = (
   client: S3Client,
   variant: Variant,
   options: CloneOptions
): S3Client => {
   const clone = clones.get(client);
   if (clone?.variant === variant) return client;
   const base = clone?.base ?? client;
   const held = variants.get(base) ?? {};
   const existing = held[variant];
   if (existing) return existing;
   const created = cloneS3Client(base, options);
   clones.set(created, { base, variant });
   held[variant] = created;
   variants.set(base, held);
   return created;
};

const withoutRetries = (client: S3Client): S3Client =>
   cachedClone(client, "once", { maxAttempts: 1 });

// cleanup must bypass an exhausted request budget or abandoned parts remain billable.
const forCleanup = (client: S3Client): S3Client =>
   cachedClone(client, "cleanup", {
      maxAttempts: CLEANUP_MAX_ATTEMPTS,
      budget: "none",
   });

// a bulk cancel reports each failure back for the user to retry, so it spends one attempt per upload.
const forCancel = (client: S3Client, retry = true): S3Client =>
   retry
      ? cachedClone(client, "cancel", {
           maxAttempts: CLEANUP_MAX_ATTEMPTS,
           budget: "cancels",
        })
      : cachedClone(client, "cancelOnce", {
           maxAttempts: 1,
           budget: "cancels",
        });

const withoutBudget = (client: S3Client): S3Client =>
   cachedClone(client, "unbudgeted", { maxAttempts: 1, budget: "none" });

// a part copy only stages bytes under the upload id, so retrying one cannot commit anything twice;
// initiation and completion stay on the caller's single-attempt client.
const forPartCopies = (client: S3Client): S3Client =>
   cachedClone(client, "parts", { maxAttempts: 3 });

export { forCancel, forCleanup, forPartCopies, withoutBudget, withoutRetries };
