import {
   GetBucketOwnershipControlsCommand,
   type S3Client,
} from "@aws-sdk/client-s3";
import { storageFailure } from "./classify";
import { describeFailure, isForbiddenFailure } from "./failure";
import type { S3Scope } from "./listing";
import { withReleased } from "./response-collector";
import { SECOND_MS } from "@s3-viewer/shared";
import { StorageError } from "./errors";

// "hidden" is a denied read: the bucket may or may not accept ACLs.
type Ownership = "acl" | "enforced" | "hidden";
type Answer = { ownership: Ownership; expiresAt: number };

const ANSWER_TTL_MS = 10 * SECOND_MS;

const answers = new WeakMap<S3Client, Map<string, Answer>>();

const readOwnership = async ({
   client,
   bucket,
   signal,
}: S3Scope): Promise<Ownership> => {
   try {
      const output = await client.send(
         new GetBucketOwnershipControlsCommand({ Bucket: bucket }),
         { abortSignal: signal }
      );
      return withReleased(output, () => {
         const ownership =
            output.OwnershipControls?.Rules?.[0]?.ObjectOwnership;
         if (ownership === "BucketOwnerEnforced") return "enforced";
         if (
            ownership === "BucketOwnerPreferred" ||
            ownership === "ObjectWriter"
         )
            return "acl";
         throw new StorageError(
            "upstream",
            "Storage returned invalid bucket ownership settings."
         );
      });
   } catch (error) {
      const failure = describeFailure(error);
      if (
         failure.name === "OwnershipControlsNotFoundError" &&
         failure.httpStatus === 404
      )
         return "acl";
      if (isForbiddenFailure(failure)) return "hidden";
      throw storageFailure(error);
   }
};

const bucketOwnership = async (scope: S3Scope): Promise<Ownership> => {
   const now = Date.now();
   const known = answers.get(scope.client) ?? new Map<string, Answer>();
   const answer = known.get(scope.bucket);
   if (answer && answer.expiresAt > now) return answer.ownership;
   const ownership = await readOwnership(scope);
   known.set(scope.bucket, { ownership, expiresAt: now + ANSWER_TTL_MS });
   answers.set(scope.client, known);
   return ownership;
};

const destinationAcceptsAcl = async (scope: S3Scope): Promise<boolean> =>
   (await bucketOwnership(scope)) === "acl";

// only a definite answer may drop grants a same-bucket source already holds, so a failed read
// (5xx, NotImplemented, an odd body) keeps them and stays uncached for the next copy to retry.
const aclsDisabled = async (scope: S3Scope): Promise<boolean> => {
   try {
      return (await bucketOwnership(scope)) === "enforced";
   } catch (error) {
      if (scope.signal?.aborted) throw error;
      return false;
   }
};

export { aclsDisabled, destinationAcceptsAcl };
