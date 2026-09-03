import { ApiError, api } from "@/lib/api";
import { BucketCheck, ValidateBucketsInput } from "@s3-viewer/types";
import { useMutation } from "@tanstack/react-query";

const useValidateBuckets = () =>
   useMutation<BucketCheck[], ApiError, ValidateBucketsInput>({
      mutationFn: async (body) =>
         (
            await api.post<{ results: BucketCheck[] }>(
               "/servers/validate-buckets",
               body
            )
         ).results,
   });

export default useValidateBuckets;
