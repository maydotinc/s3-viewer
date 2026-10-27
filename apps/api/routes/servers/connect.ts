import { requestSignal } from "@/lib/http";
import { requireUser } from "@/lib/middleware/authorize";
import { connectLimit } from "@/lib/middleware/rate-limit";
import { validatedRoute } from "@/lib/middleware/route";
import { getS3ClientFromCredentials } from "@/lib/s3/client-cache";
import {
   canHeadBucket,
   CONNECT_TIMEOUT_MS,
   countBuckets,
} from "@/lib/s3/probe";
import { openCredentials } from "@/lib/services/servers";
import {
   establishSchema,
   mapLimit,
   validateBucketsSchema,
   type BucketCheck,
   type EstablishInput,
   type EstablishResult,
   type ValidateBucketsInput,
   SECOND_MS,
} from "@s3-viewer/shared";
import { Router, type Request, type Response } from "express";

const connectRouter: Router = Router();

const VALIDATE_TIMEOUT_MS = 30 * SECOND_MS;
const VALIDATE_CONCURRENCY = 5;

const establish = async (
   req: Request,
   res: Response,
   input: EstablishInput
) => {
   const user = requireUser(req);
   const { encryptedCredentials } = input;
   const { credentials, provider } = await openCredentials(
      encryptedCredentials,
      user.id
   );
   const bucketCount = await countBuckets(
      getS3ClientFromCredentials(credentials, provider),
      "Establish",
      requestSignal(res, CONNECT_TIMEOUT_MS)
   );
   const result: EstablishResult = {
      listBucketsAllowed: bucketCount !== null,
      bucketCount: bucketCount ?? 0,
      provider,
   };
   res.json(result);
};

const validateBuckets = async (
   req: Request,
   res: Response,
   input: ValidateBucketsInput
) => {
   const user = requireUser(req);
   const { encryptedCredentials, bucketNames } = input;
   const { credentials, provider } = await openCredentials(
      encryptedCredentials,
      user.id
   );
   const client = getS3ClientFromCredentials(credentials, provider);
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
