import { ApiError, api } from "@/lib/api";
import {
   BucketCheck,
   MAX_VALIDATE_BUCKETS,
   ValidateBucketsInput,
   chunk,
} from "@s3-viewer/types";
import { useMutation } from "@tanstack/react-query";

const useValidateBuckets = () =>
   useMutation<BucketCheck[], ApiError, ValidateBucketsInput>({
      mutationFn: async ({ encryptedCredentials, bucketNames }) => {
         const results: BucketCheck[] = [];
         for (const names of chunk(bucketNames, MAX_VALIDATE_BUCKETS)) {
            const page = await api.post<{ results: BucketCheck[] }>(
               "/servers/validate-buckets",
               { encryptedCredentials, bucketNames: names }
            );
            results.push(...page.results);
         }
         return results;
      },
   });

export default useValidateBuckets;
