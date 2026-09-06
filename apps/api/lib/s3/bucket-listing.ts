import {
   ListBucketsCommand,
   type Bucket,
   type S3Client,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { ApiHttpError } from "../http";
import { clientProvider } from "./provider";

const MAX_BUCKET_PAGES = 50;

const listBuckets = async (
   client: S3Client,
   signal: AbortSignal
): Promise<Bucket[]> => {
   const provider = await clientProvider(client);
   const buckets = new Map<string, Bucket>();
   const tokens = new Set<string>();
   let token: string | undefined;
   for (let page = 0; page < MAX_BUCKET_PAGES; page++) {
      const command = new ListBucketsCommand({ ContinuationToken: token });
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
      const out = await client.send(command, { abortSignal: signal });
      for (const bucket of out.Buckets ?? []) {
         if (bucket.Name) buckets.set(bucket.Name, bucket);
      }
      token =
         provider === Provider.R2
            ? r2Headers?.["cf-next-continuation-token"] || undefined
            : out.ContinuationToken;
      if (!token) {
         if (r2Headers?.["cf-is-truncated"] === "true")
            throw new ApiHttpError(
               502,
               "Storage returned an incomplete bucket listing. Try again."
            );
         return [...buckets.values()];
      }
      if (tokens.has(token))
         throw new ApiHttpError(
            502,
            "Storage repeated a bucket listing page. Try again."
         );
      tokens.add(token);
   }
   throw new ApiHttpError(
      502,
      "The bucket listing exceeded its page limit. Connect with a named bucket selection."
   );
};

export { listBuckets };
