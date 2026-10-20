import useObjectMutation, {
   forgetTouched,
   postKeyChange,
} from "./object-mutation";

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
