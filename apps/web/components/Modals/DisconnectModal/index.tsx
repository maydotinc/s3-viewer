import type { ModalProps } from "@/lib/contexts/modal-props";
import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import StaleSignIn, { isSessionStale } from "@/components/stale-sign-in";
import useDeleteServer from "@/lib/hooks/mutations/server/useDeleteServer";
import useLeaveServer from "@/lib/hooks/mutations/server/useLeaveServer";
import { Permission, hasPermission } from "@s3-viewer/permissions";

type DisconnectModalProps = ModalProps<"disconnect">;

const DisconnectModal = ({ server, onClose }: DisconnectModalProps) => {
   const canDelete = hasPermission(server.userRole, Permission.DELETE_SERVER);
   const deleteServer = useDeleteServer();
   const leaveServer = useLeaveServer();
   const mutation = canDelete ? deleteServer : leaveServer;

   const confirm = () =>
      mutation.mutate({ serverId: server.id }, { onSuccess: onClose });
   const stale = isSessionStale(mutation.error);

   return (
      <ConfirmDialog
         closable={!mutation.isPending}
         onClose={onClose}
         title={canDelete ? "Delete server" : "Leave server"}
         description={
            canDelete
               ? `This deletes the connection to ${server.name}, all member access and pending invites; your buckets and files are not touched.`
               : `You'll lose access to ${server.name} until someone invites you again.`
         }
         error={stale ? null : (mutation.error?.message ?? null)}
         confirmVariant="destructive"
         confirmLabel={canDelete ? "Delete server" : "Leave server"}
         isPending={mutation.isPending}
         onConfirm={confirm}
      >
         {stale && (
            <StaleSignIn
               title="Sign in again to delete this server"
               action="deleting a server"
            />
         )}
      </ConfirmDialog>
   );
};

export default DisconnectModal;
