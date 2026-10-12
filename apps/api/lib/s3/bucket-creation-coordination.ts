import { LOCK_NAMESPACE, xactLock } from "@/lib/db-locks";
import { ApiHttpError } from "@/lib/http";
import { detectProvider } from "@/lib/utils/detect-provider";
import { MINUTE_MS, Provider } from "@s3-viewer/types";
import { prisma } from "@s3-viewer/db";
import { randomUUID } from "node:crypto";

type BucketCreationLifecycle = {
   submitted: () => Promise<void>;
   settled: () => void;
};
const MAX_BUCKET_CREATIONS = 1_000;
const MAX_USER_BUCKET_CREATIONS = 20;
const UNRESOLVED_CREATION_TTL_MS = 15 * MINUTE_MS;

const bucketCreationNamespace = (endpoint: string): string => {
   const url = new URL(endpoint);
   url.hostname = url.hostname.replace(/\.$/, "");
   if (detectProvider(url.href) === Provider.S3) {
      if (url.hostname.endsWith(".amazonaws.com.cn")) return "aws-cn";
      if (/[.-]us-gov-/.test(url.hostname)) return "aws-us-gov";
      return "aws";
   }
   return `endpoint:${url.origin}`;
};

type BucketCreationScope = {
   endpoint: string;
   bucketName: string;
   userId: string;
};

const withBucketCreation = async <T>(
   { endpoint, bucketName, userId }: BucketCreationScope,
   create: (lifecycle: BucketCreationLifecycle) => Promise<T>
): Promise<T> => {
   const namespace = bucketCreationNamespace(endpoint);
   const operation = randomUUID();
   await prisma.$transaction(async (tx) => {
      await xactLock(tx, LOCK_NAMESPACE.BUCKET_CREATION, 0);
      await tx.bucketCreation.deleteMany({
         where: {
            createdAt: {
               lt: new Date(Date.now() - UNRESOLVED_CREATION_TTL_MS),
            },
         },
      });
      const existing = await tx.bucketCreation.findUnique({
         where: { namespace_bucketName: { namespace, bucketName } },
      });
      if (existing)
         throw new ApiHttpError(
            409,
            `${bucketName} has an active or unresolved creation request. Wait for it to finish; if it was interrupted, try again in 15 minutes.`
         );
      if (
         (await tx.bucketCreation.count({ where: { userId } })) >=
            MAX_USER_BUCKET_CREATIONS ||
         (await tx.bucketCreation.count({ where: { namespace } })) >=
            MAX_BUCKET_CREATIONS
      ) {
         throw new ApiHttpError(
            503,
            "Bucket creation capacity is busy. Try again in 15 minutes."
         );
      }
      await tx.bucketCreation.create({
         data: { namespace, bucketName, operation, userId },
      });
   });
   let outcomeKnown = true;
   try {
      return await create({
         submitted: async () => {
            await prisma.bucketCreation.update({
               where: { operation },
               data: { submitted: true },
            });
            outcomeKnown = false;
         },
         settled: () => {
            outcomeKnown = true;
         },
      });
   } finally {
      // neither a timeout nor a process restart proves the provider stopped.
      if (outcomeKnown)
         await prisma.bucketCreation.deleteMany({ where: { operation } });
   }
};

export { bucketCreationNamespace, withBucketCreation };
export type { BucketCreationLifecycle };
