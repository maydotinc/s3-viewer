import {
   CenteredDialogHeader,
   ConfirmFooter,
} from "@/components/Modals/confirm-dialog";
import useCreateBucket from "@/lib/hooks/mutations/bucket/useCreateBucket";
import { bucketNameSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Dialog, DialogContent } from "@s3-viewer/ui/components/dialog";
import { Input } from "@s3-viewer/ui/components/input";
import { toast } from "@s3-viewer/ui/components/toast";
import { cn } from "@s3-viewer/ui/lib/utils";
import { FolderPlus } from "lucide-react";
import { useId, useState } from "react";

type CreateBucketModalProps = { onClose: () => void };

const NAME_RULES =
   "3–63 characters: lowercase letters, numbers, dots and hyphens.";

const CreateBucketModal = ({ onClose }: CreateBucketModalProps) => {
   const createBucket = useCreateBucket();
   const inputId = useId();
   const hintId = useId();
   const [name, setName] = useState("");
   const [touched, setTouched] = useState(false);
   const [requestError, setRequestError] = useState<string | null>(null);

   const trimmed = name.trim();
   const valid = bucketNameSchema.safeParse(trimmed).success;
   const validation = touched && trimmed && !valid ? NAME_RULES : null;
   const invalid = Boolean(requestError ?? validation);

   const submit = () => {
      setTouched(true);
      if (!valid || createBucket.isPending) return;
      setRequestError(null);
      createBucket.mutate(trimmed, {
         onSuccess: (bucket) => {
            toast.success(`Bucket ${bucket.name} created.`);
            onClose();
         },
         onError: (error) => setRequestError(error.message),
      });
   };

   return (
      <Dialog open onOpenChange={createBucket.isPending ? undefined : onClose}>
         <DialogContent className="max-w-[95%] sm:max-w-md">
            <CenteredDialogHeader icon={FolderPlus} title="Create bucket">
               {NAME_RULES}
            </CenteredDialogHeader>
            <form
               className="flex flex-col gap-2"
               onSubmit={(event) => {
                  event.preventDefault();
                  submit();
               }}
            >
               <label
                  htmlFor={inputId}
                  className="text-sm font-medium text-viewerblack"
               >
                  Bucket name
               </label>
               <Input
                  id={inputId}
                  value={name}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="my-bucket"
                  aria-invalid={invalid || undefined}
                  aria-describedby={hintId}
                  onChange={(event) => {
                     setName(event.target.value);
                     setTouched(true);
                     setRequestError(null);
                  }}
               />
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
                        Couldn&apos;t create the bucket.
                        <span className="block text-viewertext">
                           {requestError}
                        </span>
                     </>
                  ) : (
                     (validation ?? (trimmed ? null : "Enter a name"))
                  )}
               </p>
               <ConfirmFooter cancelDisabled={createBucket.isPending}>
                  <Button
                     type="submit"
                     className="flex-1"
                     loading={createBucket.isPending}
                     disabled={!valid}
                  >
                     {createBucket.isPending ? "Creating…" : "Create bucket"}
                  </Button>
               </ConfirmFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
};

export default CreateBucketModal;
