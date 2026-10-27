import useObjectMutation, {
   forgetTouched,
   postKeyChange,
} from "./useObjectMutation";

const useRenameObject = () =>
   useObjectMutation({
      mutationFn: postKeyChange<void>("rename"),
      settle: forgetTouched(({ objectKey, newObjectKey }, outcome) =>
         outcome
            ? { changed: [newObjectKey], removed: [objectKey] }
            : { changed: [newObjectKey, objectKey] }
      ),
   });

export default useRenameObject;
