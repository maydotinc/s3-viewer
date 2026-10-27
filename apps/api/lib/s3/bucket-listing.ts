import {
   ListBucketsCommand,
   type Bucket,
   type S3Client,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/shared";
import { clientProvider } from "./provider";
import { copyRetainedString, retainedRead } from "./read-budget";
import { budgetServerOf } from "./request-budget";
import { releaseBufferedResponse, withReleased } from "./response-collector";
import { StorageError } from "./errors";

const AWS_BUCKET_PAGE_SIZE = 1_000;
const MAX_AWS_BUCKET_PAGES = 500;
const MAX_COMPATIBLE_BUCKET_PAGES = 50;
const BUCKET_MEMORY_OVERHEAD = 384;

const bucketPage = async (
   client: S3Client,
   provider: Provider,
   signal: AbortSignal,
   token?: string
) => {
   const command = new ListBucketsCommand({
      ContinuationToken: token,
      ...(provider === Provider.S3 ? { MaxBuckets: AWS_BUCKET_PAGE_SIZE } : {}),
   });
   let r2Headers: Record<string, string> | undefined;
   if (provider === Provider.R2) {
      command.middlewareStack.add(
         (next) => async (args) => {
            const result = await next(args);
            r2Headers = (
               result.response as { headers?: Record<string, string> }
            ).headers;
            return result;
         },
         {
            step: "deserialize",
            name: "r2BucketPagination",
            priority: "high",
         }
      );
   }
   const output = await client.send(command, { abortSignal: signal });
   return {
      output,
      nextToken:
         provider === Provider.R2
            ? r2Headers?.["cf-next-continuation-token"] || undefined
            : output.ContinuationToken,
      truncated: r2Headers?.["cf-is-truncated"] === "true",
   };
};

const probeBucketList = async (
   client: S3Client,
   signal: AbortSignal
): Promise<void> => {
   const { output } = await bucketPage(
      client,
      await clientProvider(client),
      signal
   );
   releaseBufferedResponse(output);
};

const listBuckets = async (
   client: S3Client,
   signal: AbortSignal
): Promise<Bucket[]> => {
   const provider = await clientProvider(client);
   const buckets = new Map<string, Bucket>();
   const tokens = new Set<string>();
   let token: string | undefined;
   const maxPages =
      provider === Provider.S3
         ? MAX_AWS_BUCKET_PAGES
         : MAX_COMPATIBLE_BUCKET_PAGES;
   return retainedRead(budgetServerOf(client), async (reservation) => {
      for (let page = 0; page < maxPages; page++) {
         const {
            output: out,
            nextToken,
            truncated,
         } = await bucketPage(client, provider, signal, token);
         const listed = withReleased(out, () => {
            for (const bucket of out.Buckets ?? []) {
               if (!bucket.Name) continue;
               reservation.retain(
                  2 *
                     (bucket.Name.length +
                        (bucket.BucketRegion?.length ?? 0) +
                        (bucket.BucketArn?.length ?? 0)) +
                     BUCKET_MEMORY_OVERHEAD
               );
               const retained: Bucket = {
                  ...bucket,
                  Name: copyRetainedString(bucket.Name),
                  BucketRegion:
                     bucket.BucketRegion === undefined
                        ? undefined
                        : copyRetainedString(bucket.BucketRegion),
                  BucketArn:
                     bucket.BucketArn === undefined
                        ? undefined
                        : copyRetainedString(bucket.BucketArn),
               };
               buckets.set(retained.Name!, retained);
            }
            token = nextToken;
            if (!token) {
               if (truncated)
                  throw new StorageError(
                     "upstream",
                     "Storage returned an incomplete bucket listing. Try again."
                  );
               return [...buckets.values()];
            }
            if (tokens.has(token))
               throw new StorageError(
                  "upstream",
                  "Storage repeated a bucket listing page. Try again."
               );
            reservation.retain(2 * token.length + 64);
            token = copyRetainedString(token);
            tokens.add(token);
            return undefined;
         });
         if (listed) return listed;
      }
      throw new StorageError(
         "upstream",
         "The bucket listing exceeded its page limit. Connect with a named bucket selection."
      );
   });
};

export { listBuckets, probeBucketList };
