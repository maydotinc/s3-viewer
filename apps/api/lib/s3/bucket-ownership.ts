import {
   GetBucketOwnershipControlsCommand,
   type S3Client,
} from "@aws-sdk/client-s3";
import { ApiHttpError } from "@/lib/http";
import { throwHttpError } from "./errors";
import { describeFailure, isForbiddenFailure } from "./failure";
import type { S3Scope } from "./listing";
import { releaseBufferedResponse } from "./response-collector";

type Answer = { acceptsAcl: boolean; expiresAt: number };

const ANSWER_TTL_MS = 10_000;

const answers = new WeakMap<S3Client, Map<string, Answer>>();

const readAcceptsAcl = async ({
   client,
   bucket,
   signal,
}: S3Scope): Promise<boolean> => {
   try {
      const output = await client.send(
         new GetBucketOwnershipControlsCommand({ Bucket: bucket }),
         { abortSignal: signal }
      );
      try {
         const ownership =
            output.OwnershipControls?.Rules?.[0]?.ObjectOwnership;
         if (ownership === "BucketOwnerEnforced") return false;
         if (
            ownership === "BucketOwnerPreferred" ||
            ownership === "ObjectWriter"
         )
            return true;
         throw new ApiHttpError(
            502,
            "Storage returned invalid bucket ownership settings."
         );
      } finally {
         releaseBufferedResponse(output);
      }
   } catch (error) {
      const failure = describeFailure(error);
      if (
         failure.name === "OwnershipControlsNotFoundError" &&
         failure.httpStatus === 404
      )
         return true;
      if (isForbiddenFailure(failure)) return false;
      return throwHttpError(error);
   }
};

const destinationAcceptsAcl = async (scope: S3Scope): Promise<boolean> => {
   const now = Date.now();
   const known = answers.get(scope.client) ?? new Map<string, Answer>();
   const answer = known.get(scope.bucket);
   if (answer && answer.expiresAt > now) return answer.acceptsAcl;
   const acceptsAcl = await readAcceptsAcl(scope);
   known.set(scope.bucket, { acceptsAcl, expiresAt: now + ANSWER_TTL_MS });
   answers.set(scope.client, known);
   return acceptsAcl;
};

export { destinationAcceptsAcl };
