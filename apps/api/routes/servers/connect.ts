import { ApiHttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { connectLimit } from "@/lib/middleware/rate-limit";
import { validatedRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { getS3ClientFromCredentials } from "@/lib/s3/client-cache";
import { readCredentials } from "@/lib/services/servers";
import { detectProvider } from "@/lib/utils/detect-provider";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
import {
   HeadBucketCommand,
   ListBucketsCommand,
   S3ServiceException,
   type S3Client,
} from "@aws-sdk/client-s3";
import {
   establishSchema,
   mapLimit,
   validateBucketsSchema,
   type BucketCheck,
   type EstablishInput,
   type EstablishResult,
   type ValidateBucketsInput,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const connectRouter: Router = Router();

const CONNECT_TIMEOUT_MS = 15_000;
const VALIDATE_TIMEOUT_MS = 30_000;
const VALIDATE_CONCURRENCY = 5;

const isAccessDenied = (err: unknown): boolean =>
   err instanceof S3ServiceException && err.name === "AccessDenied";

const countBuckets = async (client: S3Client): Promise<number | null> => {
   try {
      const out = await client.send(new ListBucketsCommand({}), {
         abortSignal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      });
      return out.Buckets?.length ?? 0;
   } catch (err) {
      if (isAccessDenied(err)) return null;
      logger.info("Establish failed", {
         error: err instanceof Error ? err.name : "unknown",
      });
      throw new ApiHttpError(400, "Could not connect with those credentials");
   }
};

const establish = async (_req: Request, res: Response) => {
   const { encryptedCredentials } = input<EstablishInput>(res);
   const credentials = readCredentials(encryptedCredentials);
   await assertPublicEndpoint(credentials.endpoint);
   const bucketCount = await countBuckets(
      getS3ClientFromCredentials(credentials)
   );
   const result: EstablishResult = {
      listBucketsAllowed: bucketCount !== null,
      bucketCount: bucketCount ?? 0,
      provider: detectProvider(credentials.endpoint),
   };
   res.json(result);
};

const canHeadBucket = async (
   client: S3Client,
   bucketName: string,
   abortSignal: AbortSignal
): Promise<boolean> => {
   try {
      await client.send(new HeadBucketCommand({ Bucket: bucketName }), {
         abortSignal,
      });
      return true;
   } catch {
      return false;
   }
};

const validateBuckets = async (_req: Request, res: Response) => {
   const { encryptedCredentials, bucketNames } =
      input<ValidateBucketsInput>(res);
   const credentials = readCredentials(encryptedCredentials);
   await assertPublicEndpoint(credentials.endpoint);
   const client = getS3ClientFromCredentials(credentials);
   const deadline = AbortSignal.timeout(VALIDATE_TIMEOUT_MS);
   const results = await mapLimit(
      bucketNames,
      VALIDATE_CONCURRENCY,
      async (bucketName): Promise<BucketCheck> => ({
         bucketName,
         accessible: await canHeadBucket(client, bucketName, deadline),
      })
   );
   res.json({ results });
};

connectRouter.post(
   "/establish",
   connectLimit,
   ...validatedRoute(establishSchema, establish)
);
connectRouter.post(
   "/validate-buckets",
   connectLimit,
   ...validatedRoute(validateBucketsSchema, validateBuckets)
);

export { connectRouter };
