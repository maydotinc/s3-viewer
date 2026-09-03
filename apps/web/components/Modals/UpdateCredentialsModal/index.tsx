import {
   CredentialsFields,
   EMPTY_CREDENTIALS,
   toServerCredentials,
   validateCredentialFields,
   type CredentialFields,
} from "@/components/Modals/ConnectModal/credentials-fields";
import FormError from "@/components/Modals/form-error";
import useUpdateCredentials from "@/lib/hooks/mutations/server/useUpdateCredentials";
import { encryptCredentials } from "@/lib/utils/encryption";
import type { ServerInfo } from "@s3-viewer/types";
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
import { FormEvent, useState } from "react";

type UpdateCredentialsModalProps = {
   server: ServerInfo;
   onUpdated?: () => void;
   onClose: () => void;
};

const UpdateCredentialsModal = ({
   server,
   onUpdated,
   onClose,
}: UpdateCredentialsModalProps) => {
   const [fields, setFields] = useState<CredentialFields>(EMPTY_CREDENTIALS);
   const [error, setError] = useState<string | null>(null);
   const update = useUpdateCredentials();

   const set = (key: keyof CredentialFields, value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      setError(null);
   };

   const submit = async (e: FormEvent) => {
      e.preventDefault();
      const message = validateCredentialFields(fields);
      if (message) {
         setError(message);
         return;
      }
      let encryptedCredentials: string;
      try {
         encryptedCredentials = await encryptCredentials(
            toServerCredentials(fields)
         );
      } catch {
         setError("Couldn't encrypt the credentials in this browser");
         return;
      }
      update.mutate(
         { serverId: server.id, encryptedCredentials },
         {
            onSuccess: () => {
               onUpdated?.();
               onClose();
            },
            onError: (err) => setError(err.message),
         }
      );
   };

   return (
      <Dialog
         open
         onOpenChange={(open) => {
            if (!open && !update.isPending) onClose();
         }}
      >
         <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-left">
               <DialogTitle>Update credentials</DialogTitle>
               <DialogDescription>
                  Enter new keys for {server.name}. They are encrypted before
                  leaving your browser.
               </DialogDescription>
            </DialogHeader>
            <form
               onSubmit={submit}
               className="flex min-h-0 flex-col"
               autoComplete="off"
            >
               <DialogBody className="flex flex-col gap-4">
                  <CredentialsFields
                     fields={fields}
                     onChange={set}
                     idPrefix="update-credentials"
                     autoFocus
                  />
                  <FormError>{error}</FormError>
               </DialogBody>
               <DialogFooter>
                  <Button type="submit" loading={update.isPending}>
                     Save
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
};

export default UpdateCredentialsModal;
