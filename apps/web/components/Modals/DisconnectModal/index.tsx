import type { ModalProps } from "@/lib/contexts/modal-props";
import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import StaleSignIn, {
   isSessionStale,
   signInAgain,
} from "@/components/stale-sign-in";
import useDeleteServer from "@/lib/hooks/mutations/server/useDeleteServer";
import useLeaveServer from "@/lib/hooks/mutations/server/useLeaveServer";
import { Button } from "@s3-viewer/ui/components/button";
import { Role } from "@s3-viewer/types";

type DisconnectModalProps = ModalProps<"disconnect">;

const DisconnectModal = ({ server, onClose }: DisconnectModalProps) => {
   const isOwner = server.userRole === Role.OWNER;
   const deleteServer = useDeleteServer();
   const leaveServer = useLeaveServer();
   const mutation = isOwner ? deleteServer : leaveServer;

   const confirm = () =>
      mutation.mutate({ serverId: server.id }, { onSuccess: onClose });
   const stale = isSessionStale(mutation.error);

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
         reserveErrorSpace
         error={stale ? null : (mutation.error?.message ?? null)}
         confirmVariant="destructive"
         confirmLabel={isOwner ? "Delete server" : "Leave server"}
         isPending={mutation.isPending}
         onConfirm={confirm}
      >
         {stale && (
            <StaleSignIn
               title="Sign in again to delete this server"
               action="deleting a server"
               actions={
                  <Button size="sm" onClick={signInAgain}>
                     Sign in again
                  </Button>
               }
            />
         )}
      </ConfirmDialog>
   );
};

export default DisconnectModal;
