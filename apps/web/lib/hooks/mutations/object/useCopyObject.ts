import type { S3ObjectUploaded } from "@s3-viewer/types";
import type { KeyChangeInput } from "@/lib/types";
import useObjectMutation, {
   forgetTouched,
   keyChangeTouched,
   postKeyChange,
} from "./object-mutation";

const useCopyObject = () =>
   useObjectMutation({
      mutationFn: postKeyChange<
         S3ObjectUploaded,
         KeyChangeInput & { expectedDestinationETag?: string }
      >("copy"),
      settle: forgetTouched(keyChangeTouched),
   });

export default useCopyObject;
