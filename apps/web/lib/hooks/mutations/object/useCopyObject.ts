import type { S3ObjectUploaded } from "@s3-viewer/shared";
import type { KeyChangeInput } from "@/lib/types";
import useObjectMutation, {
   forgetTouched,
   postKeyChange,
} from "./useObjectMutation";

const useCopyObject = () =>
   useObjectMutation({
      mutationFn: postKeyChange<
         S3ObjectUploaded,
         KeyChangeInput & { expectedDestinationETag?: string }
      >("copy"),
      settle: forgetTouched(({ newObjectKey }) => ({
         changed: [newObjectKey],
      })),
   });

export default useCopyObject;
