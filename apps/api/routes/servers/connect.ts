import { connectLimit } from "@/lib/middleware/rate-limit";
import { validatedRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { getS3ClientFromCredentials } from "@/lib/s3/client-cache";
import { canHeadBucket, countBuckets } from "@/lib/s3/probe";
import { readCredentials } from "@/lib/services/servers";
import { detectProvider } from "@/lib/utils/detect-provider";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
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

const VALIDATE_TIMEOUT_MS = 30_000;
const VALIDATE_CONCURRENCY = 5;

const establish = async (_req: Request, res: Response) => {
   const { encryptedCredentials } = input<EstablishInput>(res);
   const credentials = readCredentials(encryptedCredentials);
   await assertPublicEndpoint(credentials.endpoint);
   const bucketCount = await countBuckets(
      getS3ClientFromCredentials(credentials),
      "Establish"
   );
   const result: EstablishResult = {
      listBucketsAllowed: bucketCount !== null,
      bucketCount: bucketCount ?? 0,
      provider: detectProvider(credentials.endpoint),
   };
   res.json(result);
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
