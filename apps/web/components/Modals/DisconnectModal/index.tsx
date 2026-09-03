import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import useDeleteServer from "@/lib/hooks/mutations/server/useDeleteServer";
import useLeaveServer from "@/lib/hooks/mutations/server/useLeaveServer";
import { Role, ServerInfo } from "@s3-viewer/types";

type DisconnectModalProps = {
   server: ServerInfo;
   onClose: () => void;
};

const DisconnectModal = ({ server, onClose }: DisconnectModalProps) => {
   const isOwner = server.userRole === Role.OWNER;
   const deleteServer = useDeleteServer();
   const leaveServer = useLeaveServer();
   const mutation = isOwner ? deleteServer : leaveServer;

   const confirm = () =>
      mutation.mutate({ serverId: server.id }, { onSuccess: onClose });

   return (
      <ConfirmDialog
         closable={!mutation.isPending}
         onClose={onClose}
         title={isOwner ? "Delete server" : "Leave server"}
         description={
            isOwner
               ? `This deletes the connection to ${server.name}, all member access and pending invites; your buckets and files are not touched.`
               : `You'll lose access to ${server.name} until someone invites you again.`
         }
         error={mutation.error?.message ?? null}
         confirmVariant="destructive"
         confirmLabel={isOwner ? "Delete server" : "Leave server"}
         isPending={mutation.isPending}
         onConfirm={confirm}
      />
   );
};

export default DisconnectModal;
