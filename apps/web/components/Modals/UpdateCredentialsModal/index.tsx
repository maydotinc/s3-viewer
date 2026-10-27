import type { ModalProps } from "@/lib/contexts/modal-props";
import {
   CredentialsFields,
   CredentialsFieldsSkeleton,
   EMPTY_CREDENTIALS,
   type CredentialFields,
} from "@/components/Modals/ConnectModal/credentials-fields";
import { EncryptionStatus } from "@/components/Modals/ConnectModal/encryption-status";
import { sealCredentialFields } from "@/components/Modals/ConnectModal/seal-credentials";
import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import StaleSignIn, { isSessionStale } from "@/components/stale-sign-in";
import { errorMessage } from "@/lib/api";
import useUpdateCredentials from "@/lib/hooks/mutations/server/useUpdateCredentials";
import useInstanceConfig, {
   encryptionState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { useUserId } from "@/lib/stores/session-store";
import { useState, type FormEvent } from "react";

type UpdateCredentialsModalProps = ModalProps<"updateCredentials">;

const UpdateCredentialsModal = ({
   server,
   onUpdated,
   onClose,
}: UpdateCredentialsModalProps) => {
   const [fields, setFields] = useState<CredentialFields>(EMPTY_CREDENTIALS);
   const [error, setError] = useState<string | null>(null);
   const [encrypting, setEncrypting] = useState(false);
   const update = useUpdateCredentials();
   const config = useInstanceConfig();
   const userId = useUserId();
   const keyState = encryptionState(config);
   const stale = isSessionStale(update.error);

   const set = (key: keyof CredentialFields, value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      setError(null);
   };

   const submit = async (e: FormEvent) => {
      e.preventDefault();
      if (encrypting || update.isPending) return;
      setEncrypting(true);
      const sealed = await sealCredentialFields(fields, config.data, userId);
      setEncrypting(false);
      if ("error" in sealed) {
         setError(sealed.error);
         return;
      }
      update.mutate(
         { serverId: server.id, encryptedCredentials: sealed.encrypted },
         {
            onSuccess: () => {
               onUpdated?.();
               onClose();
            },
            onError: (err) =>
               setError(isSessionStale(err) ? null : errorMessage(err)),
         }
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={encrypting || update.isPending}
         title="Update credentials"
         description={
            <>
               Enter new keys for {server.name}. They are encrypted before
               leaving your browser.
            </>
         }
         bodyClassName="flex flex-col gap-4"
         formAutoComplete="off"
         onSubmit={submit}
         submitLabel="Save"
         submitDisabled={keyState !== "ready"}
      >
         {keyState === "loading" ? (
            <>
               <CredentialsFieldsSkeleton />
               <span className="sr-only">Loading instance settings</span>
            </>
         ) : keyState === "ready" ? (
            <>
               <CredentialsFields
                  fields={fields}
                  onChange={set}
                  idPrefix="update-credentials"
                  autoFocus
               />
               {stale ? (
                  <StaleSignIn
                     title="Sign in again to replace these credentials"
                     action="replacing credentials"
                  />
               ) : (
                  <FormError>{error}</FormError>
               )}
            </>
         ) : (
            <div className="flex min-h-80 items-center justify-center">
               <EncryptionStatus state={keyState} />
            </div>
         )}
      </FormDialog>
   );
};

export default UpdateCredentialsModal;
