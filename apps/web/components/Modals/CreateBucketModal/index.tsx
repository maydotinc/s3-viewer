import type { ModalProps } from "@/lib/contexts/modal-props";
import { FormDialog } from "@/components/Modals/form-dialog";
import { NameField, useNameField } from "@/components/Modals/name-field";
import useCreateBucket from "@/lib/hooks/mutations/bucket/useCreateBucket";
import { bucketNameSchema } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import type { FormEvent } from "react";

type CreateBucketModalProps = ModalProps<"createBucket">;

const NAME_RULES = "3–63 lowercase letters, numbers, dots and hyphens.";

const CreateBucketModal = ({ onClose }: CreateBucketModalProps) => {
   const createBucket = useCreateBucket();
   const field = useNameField(
      (name) => (bucketNameSchema.safeParse(name).success ? null : NAME_RULES),
      { hideEmptyError: true }
   );

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (createBucket.isPending || !field.valid) return;
      createBucket.mutate(
         field.trimmed,
         field.attempt(({ bucket, existing }) => {
            toast.success(
               existing
                  ? `Bucket ${bucket.name} added to this server.`
                  : `Bucket ${bucket.name} created.`
            );
            onClose();
         })
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={createBucket.isPending}
         title="Create bucket"
         description={NAME_RULES}
         onSubmit={submit}
         submitLabel="Create bucket"
         submitDisabled={!field.valid}
      >
         <NameField field={field} label="Bucket name" placeholder="my-bucket" />
      </FormDialog>
   );
};

export default CreateBucketModal;
