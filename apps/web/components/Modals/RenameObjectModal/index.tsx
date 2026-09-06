import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import { errorMessage } from "@/lib/api";
import useRenameObject from "@/lib/hooks/mutations/object/useRenameObject";
import usePathSuggestion, {
   isAcceptSuggestionKey,
} from "@/lib/hooks/usePathSuggestion";
import { formatBytes } from "@/lib/utils/format";
import { MAX_RENAME_BYTES, isFolderKey } from "@s3-viewer/types";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { toast } from "@s3-viewer/ui/components/toast";
import { FormEvent, useId, useState } from "react";

type RenameObjectModalProps = {
   onClose: () => void;
   userId: string;
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

const RenameObjectModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   objectKey,
   onRenameSuccess,
}: RenameObjectModalProps) => {
   const rename = useRenameObject();
   const inputId = useId();
   const errorId = useId();
   const [value, setValue] = useState(objectKey);
   const [touched, setTouched] = useState(false);
   const [requestError, setRequestError] = useState<string | null>(null);

   const newKey = value.trim();
   const validation = validate(newKey, objectKey);
   const suggestion = usePathSuggestion(bucketName, newKey, {
      userId,
      serverId,
   });
   const error = requestError ?? (touched ? validation : null);

   const acceptSuggestion = () => {
      if (!suggestion) return;
      const slash = suggestion.indexOf("/");
      setValue(
         newKey + (slash >= 0 ? suggestion.slice(0, slash + 1) : suggestion)
      );
   };

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (rename.isPending || validation) return;
      setRequestError(null);
      rename.mutate(
         { userId, serverId, bucketName, objectKey, newObjectKey: newKey },
         {
            onSuccess: () => {
               toast.success("Object renamed.");
               onRenameSuccess?.(newKey);
               onClose();
            },
            onError: (failure) => setRequestError(errorMessage(failure)),
         }
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={rename.isPending}
         title="Rename object"
         description={
            <>
               Edit the full key to move or rename this object; objects over{" "}
               {formatBytes(MAX_RENAME_BYTES)} can&apos;t be renamed.
            </>
         }
         onSubmit={submit}
         submitLabel="Rename"
         submitDisabled={validation !== null}
      >
         <div className="flex items-center justify-between gap-2">
            <Label htmlFor={inputId}>Object key</Label>
            <span className="text-xs text-viewerlighttext" aria-hidden="true">
               {suggestion ? "→ to autocomplete" : ""}
            </span>
         </div>
         <div className="relative">
            <Input
               id={inputId}
               value={value}
               autoFocus
               autoComplete="off"
               spellCheck={false}
               aria-invalid={error ? true : undefined}
               aria-describedby={errorId}
               onChange={(event) => {
                  setValue(event.target.value);
                  setTouched(true);
                  setRequestError(null);
               }}
               onBlur={() => setTouched(true)}
               onKeyDown={(event) => {
                  if (suggestion && isAcceptSuggestionKey(event)) {
                     event.preventDefault();
                     acceptSuggestion();
                  }
               }}
            />
            {suggestion && (
               <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-3 text-sm"
               >
                  <span className="invisible">{value}</span>
                  <span className="text-viewerlighttext">{suggestion}</span>
               </div>
            )}
         </div>
         <FormError id={errorId}>{error}</FormError>
      </FormDialog>
   );
};

export default RenameObjectModal;
