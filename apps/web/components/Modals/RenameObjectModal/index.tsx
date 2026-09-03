import {
   CenteredDialogHeader,
   ConfirmFooter,
} from "@/components/Modals/confirm-dialog";
import { ApiError, errorMessage } from "@/lib/api";
import useRenameObject from "@/lib/hooks/mutations/object/useRenameObject";
import usePathSuggestion, {
   isAcceptSuggestionKey,
} from "@/lib/hooks/usePathSuggestion";
import { formatBytes } from "@/lib/utils/format";
import { MAX_RENAME_BYTES, isFolderKey } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Dialog, DialogContent } from "@s3-viewer/ui/components/dialog";
import { toast } from "@s3-viewer/ui/components/toast";
import { cn } from "@s3-viewer/ui/lib/utils";
import { FilePen } from "lucide-react";
import { useId, useState } from "react";

type RenameObjectModalProps = {
   onClose: () => void;
   serverId: string;
   bucketName: string;
   objectKey: string;
   onRenameSuccess?: (newObjectKey: string) => void;
};

const validate = (value: string, original: string): string | null => {
   if (!value) return "Enter a name.";
   if (value.startsWith("/")) return "The key can't start with a slash.";
   if (isFolderKey(value)) return "The key can't end with a slash.";
   if (
      value
         .split("/")
         .some(
            (segment) => segment === "" || segment === "." || segment === ".."
         )
   )
      return 'The key can\'t contain empty, "." or ".." segments.';
   if (value === original) return "That's the current name.";
   return null;
};

type RequestError = { title: string; detail?: string };

const requestFailure = (error: unknown): RequestError =>
   error instanceof ApiError && error.status === 409
      ? { title: "An object with that name already exists." }
      : { title: "Couldn't rename the object.", detail: errorMessage(error) };

const RenameObjectModal = ({
   onClose,
   bucketName,
   objectKey,
   onRenameSuccess,
}: RenameObjectModalProps) => {
   const rename = useRenameObject();
   const inputId = useId();
   const hintId = useId();
   const [value, setValue] = useState(objectKey);
   const [touched, setTouched] = useState(false);
   const [requestError, setRequestError] = useState<RequestError | null>(null);

   const newKey = value.trim();
   const validation = validate(newKey, objectKey);
   const suggestion = usePathSuggestion(bucketName, newKey);
   const validationMessage = touched ? validation : null;
   const invalid = Boolean(requestError ?? validationMessage);
   const helper = validation && !invalid ? "Enter a new name" : null;

   const acceptSuggestion = () => {
      if (!suggestion) return;
      const slash = suggestion.indexOf("/");
      setValue(
         newKey + (slash >= 0 ? suggestion.slice(0, slash + 1) : suggestion)
      );
   };

   const submit = () => {
      setTouched(true);
      if (validation || rename.isPending) return;
      setRequestError(null);
      rename.mutate(
         { bucketName, objectKey, newObjectKey: newKey },
         {
            onSuccess: () => {
               toast.success("Object renamed.");
               onRenameSuccess?.(newKey);
               onClose();
            },
            onError: (error) => setRequestError(requestFailure(error)),
         }
      );
   };

   return (
      <Dialog open onOpenChange={rename.isPending ? undefined : onClose}>
         <DialogContent className="max-w-[95%] sm:max-w-md">
            <CenteredDialogHeader icon={FilePen} title="Rename object">
               Edit the full key to rename or move this object. Existing objects
               are never overwritten; objects over{" "}
               {formatBytes(MAX_RENAME_BYTES)} can&apos;t be renamed.
            </CenteredDialogHeader>
            <div className="flex flex-col gap-2">
               <div className="flex items-center justify-between">
                  <label
                     htmlFor={inputId}
                     className="text-sm font-medium text-viewerblack"
                  >
                     Object key
                  </label>
                  <span
                     className="text-xs text-viewerlighttext"
                     aria-hidden={!suggestion}
                  >
                     {suggestion ? "→ to autocomplete" : ""}
                  </span>
               </div>
               <div className="relative">
                  <input
                     id={inputId}
                     type="text"
                     value={value}
                     autoFocus
                     autoComplete="off"
                     spellCheck={false}
                     aria-invalid={invalid || undefined}
                     aria-describedby={hintId}
                     onChange={(event) => {
                        setValue(event.target.value);
                        setTouched(true);
                        setRequestError(null);
                     }}
                     onKeyDown={(event) => {
                        if (event.key === "Enter") {
                           event.preventDefault();
                           submit();
                        } else if (suggestion && isAcceptSuggestionKey(event)) {
                           event.preventDefault();
                           acceptSuggestion();
                        }
                     }}
                     className="h-9 w-full rounded-lg border border-viewerborder bg-viewerwhite px-3 py-1 text-sm text-viewerblack outline-none focus-visible:ring-[3px] focus-visible:ring-viewerblue/40 aria-invalid:border-viewertextred"
                  />
                  {suggestion && (
                     <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-3 text-sm"
                     >
                        <span className="invisible">{value}</span>
                        <span className="text-viewerlighttext">
                           {suggestion}
                        </span>
                     </div>
                  )}
               </div>
               <p
                  id={hintId}
                  aria-live="polite"
                  className={cn(
                     "min-h-5 text-sm",
                     invalid ? "text-viewertextred" : "text-viewerlighttext"
                  )}
               >
                  {requestError ? (
                     <>
                        {requestError.title}
                        {requestError.detail && (
                           <span className="block text-viewertext">
                              {requestError.detail}
                           </span>
                        )}
                     </>
                  ) : (
                     (validationMessage ?? helper)
                  )}
               </p>
            </div>
            <ConfirmFooter cancelDisabled={rename.isPending}>
               <Button
                  className="flex-1"
                  onClick={submit}
                  loading={rename.isPending}
                  disabled={validation !== null}
               >
                  {rename.isPending ? "Renaming…" : "Rename"}
               </Button>
            </ConfirmFooter>
         </DialogContent>
      </Dialog>
   );
};

export default RenameObjectModal;
