import type { ModalProps } from "@/lib/contexts/modal-props";
import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { KeyDialog } from "@/components/Modals/key-dialog";
import useRequestError from "@/components/Modals/use-request-error";
import useCopyObject from "@/lib/hooks/mutations/object/useCopyObject";
import { visibleText } from "@/lib/utils/format";
import { occupiedBy } from "@/lib/utils/s3/key-exists";
import { validateObjectKey } from "@/lib/utils/s3/keys";
import { toast } from "@s3-viewer/ui/components/toast";
import { useState } from "react";

type CopyObjectModalProps = ModalProps<"copyObject">;

type ReviewedDestination = { key: string; eTag: string };

const CopyObjectModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   objectKey,
   expectedETag,
   onCopySuccess,
}: CopyObjectModalProps) => {
   const copy = useCopyObject();
   const request = useRequestError();
   const [isChecking, setIsChecking] = useState(false);
   const [conflict, setConflict] = useState<ReviewedDestination | null>(null);
   const [draft, setDraft] = useState(objectKey);

   const validate = (value: string) =>
      value === objectKey
         ? "Pick a key the original doesn't already use."
         : validateObjectKey(value);

   const run = (newObjectKey: string, expectedDestinationETag?: string) => {
      copy.mutate(
         {
            userId,
            serverId,
            bucketName,
            objectKey,
            newObjectKey,
            expectedETag,
            expectedDestinationETag,
         },
         request.attempt(
            () => {
               toast.success(
                  expectedDestinationETag === undefined
                     ? "Object copied."
                     : "Object replaced."
               );
               onCopySuccess?.(newObjectKey);
               onClose();
            },
            () => setConflict(null)
         )
      );
   };

   const submit = async (newObjectKey: string) => {
      setDraft(newObjectKey);
      request.clear();
      setIsChecking(true);
      try {
         const eTag = await occupiedBy({
            serverId,
            bucketName,
            objectKey: newObjectKey,
         });
         if (eTag === null) run(newObjectKey);
         else setConflict({ key: newObjectKey, eTag });
      } catch (failure) {
         request.fail(failure);
      } finally {
         setIsChecking(false);
      }
   };

   if (conflict)
      return (
         <ConfirmDialog
            onClose={() => setConflict(null)}
            closable={!copy.isPending}
            title="Replace the existing object?"
            description={`${visibleText(conflict.key)} already exists. Copying over it replaces that object, and the version there now can't be recovered.`}
            confirmLabel="Replace"
            confirmVariant="destructive"
            isPending={copy.isPending}
            onConfirm={() => run(conflict.key, conflict.eTag)}
         />
      );

   return (
      <KeyDialog
         onClose={onClose}
         userId={userId}
         serverId={serverId}
         bucketName={bucketName}
         title="Copy object"
         description="Give the copy its full key. The copy runs inside storage, so nothing is downloaded, and a key that is already taken is confirmed before anything is replaced."
         label="Destination key"
         submitLabel="Copy"
         initialValue={draft}
         validate={validate}
         isPending={isChecking || copy.isPending}
         requestError={request.error}
         onEdit={request.clear}
         onSubmit={(newObjectKey) => void submit(newObjectKey)}
      />
   );
};

export default CopyObjectModal;
