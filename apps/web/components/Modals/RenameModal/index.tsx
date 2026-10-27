import { FormDialog } from "@/components/Modals/form-dialog";
import { NameField, useNameField } from "@/components/Modals/name-field";
import type { ModalProps } from "@/lib/contexts/modal-props";
import useRenameServer from "@/lib/hooks/mutations/server/useRenameServer";
import { parseServerName } from "@/lib/utils/server-name";
import { PRODUCT_NAME, SERVER_NAME_MAX } from "@s3-viewer/shared";
import type { FormEvent } from "react";

type RenameModalProps = ModalProps<"rename">;

const nameError = (name: string): string | null => {
   const parsed = parseServerName(name);
   return parsed.ok ? null : parsed.error;
};

const RenameModal = ({ server, onClose }: RenameModalProps) => {
   const rename = useRenameServer();
   const field = useNameField(nameError, { initial: server.name });
   const parsed = parseServerName(field.trimmed);
   const unchanged = parsed.ok && parsed.name === server.name;

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (rename.isPending || !parsed.ok || unchanged) return;
      rename.mutate(
         { serverId: server.id, serverName: parsed.name },
         field.attempt(onClose)
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={rename.isPending}
         title="Rename server"
         description={`Only the name shown in ${PRODUCT_NAME} changes.`}
         onSubmit={submit}
         submitLabel="Rename"
         submitDisabled={unchanged || !parsed.ok}
      >
         <NameField
            field={field}
            label="Server name"
            maxLength={SERVER_NAME_MAX}
         />
      </FormDialog>
   );
};

export default RenameModal;
