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
import useInstanceConfig, {
   CONFIG_ERROR,
   encryptionState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { encryptCredentials } from "@/lib/utils/encryption";
import type { ServerInfo } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";
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
   // the instance's public key does the encrypting, so the fields stay out of
   // the way until it has arrived
   const config = useInstanceConfig();
   const keyState = encryptionState(config);

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
            toServerCredentials(fields),
            config.data?.encryptionPublicKey ?? ""
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
         submitDisabled={keyState !== "ready"}
      >
         {keyState === "ready" ? (
            <>
               <CredentialsFields
                  fields={fields}
                  onChange={set}
                  idPrefix="update-credentials"
                  autoFocus
               />
               <FormError>{error}</FormError>
            </>
         ) : (
            <div className="flex min-h-24 items-center justify-center">
               {keyState === "loading" ? (
                  <Spinner label="Loading instance settings" />
               ) : (
                  <p role="alert" className="text-sm text-viewertextred">
                     {CONFIG_ERROR}
                  </p>
               )}
            </div>
         )}
      </FormDialog>
   );
};

export default UpdateCredentialsModal;
