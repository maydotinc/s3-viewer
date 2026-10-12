import { S3_ROUTE_TIMEOUT_MS, copyDeadlineMs } from "@/lib/constants";
import { requestSignal } from "@/lib/http";
import { getAuth } from "@/lib/middleware/authorize";
import { getS3Client } from "@/lib/s3/client-cache";
import type { S3Scope } from "@/lib/s3/listing";
import { withoutRetries } from "@/lib/s3/no-retry";
import { clientProvider } from "@/lib/s3/provider";
import type { HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import type { Provider } from "@s3-viewer/types";
import type { Response } from "express";

type MutationScope = { scope: S3Scope; provider: Provider };

const readScope = async (
   bucket: string,
   res: Response,
   signal = requestSignal(res, S3_ROUTE_TIMEOUT_MS)
): Promise<S3Scope> => {
   signal.throwIfAborted();
   const client = await getS3Client(getAuth(res), bucket, signal);
   signal.throwIfAborted();
   return { client, bucket, signal };
};

const mutationScope = async (
   bucketName: string,
   res: Response
): Promise<MutationScope> => {
   const scope = await readScope(bucketName, res);
   return {
      scope: {
         ...scope,
         client: withoutRetries(scope.client),
      },
      provider: await clientProvider(scope.client),
   };
};

// storage stays silent until a copy finishes; the idle timeout would cut the socket first.
const awaitStorage = (res: Response): void => {
   res.req.setTimeout(0);
};

const copyScope = (
   scope: S3Scope,
   res: Response,
   source: HeadObjectCommandOutput
): S3Scope => {
   awaitStorage(res);
   return {
      ...scope,
      signal: requestSignal(res, copyDeadlineMs(source.ContentLength ?? 0)),
   };
};

export { awaitStorage, copyScope, mutationScope, readScope };
