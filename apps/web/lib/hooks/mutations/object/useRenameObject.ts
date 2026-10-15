import useObjectMutation, {
   forgetTouched,
   postKeyChange,
} from "./object-mutation";

const useRenameObject = () =>
   useObjectMutation({
      mutationFn: postKeyChange<void>("rename"),
      settle: forgetTouched(
         ({ newObjectKey }) => [newObjectKey],
         ({ objectKey }) => [objectKey]
      ),
   });

export default useRenameObject;
