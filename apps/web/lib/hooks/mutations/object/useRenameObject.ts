import useObjectMutation, {
   forgetTouched,
   keyChangeTouched,
   postKeyChange,
} from "./object-mutation";

const useRenameObject = () =>
   useObjectMutation({
      mutationFn: postKeyChange<void>("rename"),
      settle: forgetTouched(keyChangeTouched),
   });

export default useRenameObject;
