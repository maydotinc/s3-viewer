import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import useCreateBucket from "@/lib/hooks/mutations/bucket/useCreateBucket";
import { bucketNameSchema } from "@s3-viewer/types";
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
      <FormDialog
         onClose={onClose}
         isPending={createBucket.isPending}
         title="Create bucket"
         description={NAME_RULES}
         onSubmit={submit}
         submitLabel="Create bucket"
         submitDisabled={!valid}
      >
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
      </FormDialog>
   );
};

export default CreateBucketModal;
