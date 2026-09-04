import {
   CredentialsFields,
   EMPTY_CREDENTIALS,
   toServerCredentials,
   validateCredentialFields,
   type CredentialFields,
} from "@/components/Modals/ConnectModal/credentials-fields";
import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import useUpdateCredentials from "@/lib/hooks/mutations/server/useUpdateCredentials";
import { encryptCredentials } from "@/lib/utils/encryption";
import type { ServerInfo } from "@s3-viewer/types";
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
      <FormDialog
         onClose={onClose}
         isPending={update.isPending}
         title="Update credentials"
         description={
            <>
               Enter new keys for {server.name}. They are encrypted before
               leaving your browser.
            </>
         }
         contentClassName="sm:max-w-md"
         headerClassName="text-left"
         bodyClassName="flex flex-col gap-4"
         formAutoComplete="off"
         onSubmit={submit}
         submitLabel="Save"
      >
         <CredentialsFields
            fields={fields}
            onChange={set}
            idPrefix="update-credentials"
            autoFocus
         />
         <FormError>{error}</FormError>
      </FormDialog>
   );
};

export default UpdateCredentialsModal;
