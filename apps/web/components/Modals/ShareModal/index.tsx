import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { INVITE_TTL_DAYS, ServerInfo } from "@s3-viewer/types";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import InviteForm from "./invite-form";
import Members from "./members";

type ShareModalProps = {
   server?: ServerInfo;
   onClose: () => void;
};

const ShareModal = ({ server: serverProp, onClose }: ShareModalProps) => {
   const { currentServer } = useServers();
   const server = serverProp ?? currentServer;
   const { buckets, isBucketsLoading } = useBuckets();

   if (!server) return null;

   return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
         <DialogContent
            className="flex max-h-[90svh] flex-col overflow-y-auto sm:max-w-lg"
            onOpenAutoFocus={(e) => e.preventDefault()}
         >
            <DialogHeader className="text-left">
               <DialogTitle>Share {server.name}</DialogTitle>
               <DialogDescription>
                  Invites expire after {INVITE_TTL_DAYS} days. Members only see
                  the buckets you grant.
               </DialogDescription>
            </DialogHeader>
            <InviteForm
               serverId={server.id}
               myRole={server.userRole}
               buckets={buckets}
               isBucketsLoading={isBucketsLoading}
            />
            <Members
               serverId={server.id}
               myRole={server.userRole}
               buckets={buckets}
               isBucketsLoading={isBucketsLoading}
            />
         </DialogContent>
      </Dialog>
   );
};

export default ShareModal;
