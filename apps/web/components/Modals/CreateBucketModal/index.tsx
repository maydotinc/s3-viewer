import FormError from "@/components/Modals/form-error";
import useCreateBucket from "@/lib/hooks/mutations/bucket/useCreateBucket";
import { bucketNameSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogBody,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { toast } from "@s3-viewer/ui/components/toast";
import { FormEvent, useId, useState } from "react";

type CreateBucketModalProps = { onClose: () => void };

const NAME_RULES = "3–63 lowercase letters, numbers, dots and hyphens.";

const CreateBucketModal = ({ onClose }: CreateBucketModalProps) => {
   const createBucket = useCreateBucket();
   const inputId = useId();
   const errorId = useId();
   const [name, setName] = useState("");
   const [touched, setTouched] = useState(false);
   const [requestError, setRequestError] = useState<string | null>(null);

   const trimmed = name.trim();
   const valid = bucketNameSchema.safeParse(trimmed).success;
   // The submit button is disabled while the name is invalid, so the naming
   // rule has to surface on its own once something has been typed.
   const error =
      requestError ?? (touched && trimmed && !valid ? NAME_RULES : null);

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (createBucket.isPending || !valid) return;
      setRequestError(null);
      createBucket.mutate(trimmed, {
         onSuccess: (bucket) => {
            toast.success(`Bucket ${bucket.name} created.`);
            onClose();
         },
         onError: (failure) => setRequestError(failure.message),
      });
   };

   return (
      <Dialog open onOpenChange={createBucket.isPending ? undefined : onClose}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>Create bucket</DialogTitle>
               <DialogDescription>{NAME_RULES}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="flex min-h-0 flex-col">
               <DialogBody className="flex flex-col gap-1.5">
                  <Label htmlFor={inputId}>Bucket name</Label>
                  <Input
                     id={inputId}
                     value={name}
                     autoFocus
                     autoComplete="off"
                     spellCheck={false}
                     placeholder="my-bucket"
                     aria-invalid={error ? true : undefined}
                     aria-describedby={errorId}
                     onChange={(event) => {
                        setName(event.target.value);
                        setTouched(true);
                        setRequestError(null);
                     }}
                     onBlur={() => setTouched(true)}
                  />
                  <FormError id={errorId}>{error}</FormError>
               </DialogBody>
               <DialogFooter>
                  <Button
                     type="submit"
                     loading={createBucket.isPending}
                     disabled={!valid}
                  >
                     Create bucket
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
};

export default CreateBucketModal;
