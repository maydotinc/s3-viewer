import useAcceptInvite from "@/lib/hooks/mutations/invites/useAcceptInvite";
import useRejectInvite from "@/lib/hooks/mutations/invites/useRejectInvite";
import { useReceivedInvites } from "@/lib/hooks/queries/server/useServerInvites";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@s3-viewer/ui/components/card";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import {
   CheckCircle,
   Clock,
   Loader2,
   Mail,
   Server,
   User,
   X,
} from "lucide-react";
import { useState } from "react";

const ReceivedInvites: React.FC = () => {
   const { data: receivedInvites = [], isLoading } = useReceivedInvites();
   const acceptInviteMutation = useAcceptInvite();
   const rejectInviteMutation = useRejectInvite();
   const [processingInviteId, setProcessingInviteId] = useState<string | null>(
      null
   );
   const [rejectingInviteId, setRejectingInviteId] = useState<string | null>(
      null
   );

   const handleAcceptInvite = (inviteId: string) => {
      setProcessingInviteId(inviteId);
      acceptInviteMutation.mutate(
         { inviteId },
         {
            onSettled: () => {
               setProcessingInviteId(null);
            },
         }
      );
   };

   const handleRejectInvite = (inviteId: string) => {
      setRejectingInviteId(inviteId);
      rejectInviteMutation.mutate(
         { inviteId },
         {
            onSettled: () => {
               setRejectingInviteId(null);
            },
         }
      );
   };

   const isExpired = (expiresAt: string) => {
      return new Date(expiresAt) < new Date();
   };

   if (isLoading) {
      return (
         <div className="flex flex-col gap-2 border border-viewerborder rounded-md p-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-8 w-20" />
         </div>
      );
   }

   if (receivedInvites.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center gap-2 p-4 pt-8 text-center size-full">
            <Mail className="size-12 text-viewerblue" />
            <h3 className="text-lg text-viewerblack">No invites received</h3>
            <p className="text-viewertext">
               You don't have any pending server invitations.
            </p>
         </div>
      );
   }

   return (
      <div className="overflow-y-auto flex flex-col gap-2">
         {receivedInvites.map((invite) => {
            const isInviteProcessing = processingInviteId === invite.id;
            const isInviteExpired = isExpired(invite.expiresAt);
            const isInviteRejecting = rejectingInviteId === invite.id;

            return (
               <Card key={invite.id} className="relative p-3">
                  <CardHeader className="p-0">
                     <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                           <Server className="size-4" />
                           {invite.server.name}
                        </CardTitle>
                        <Badge
                           variant={
                              isInviteExpired ? "destructive" : "secondary"
                           }
                        >
                           {invite.role}
                        </Badge>
                     </div>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col">
                     <div className="flex items-center gap-2 text-sm text-viewertext">
                        <User className="size-3" />
                        <span>Invited by {invite.invitedBy.name}</span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-viewertext">
                        <Clock className="size-3" />
                        <span>
                           {isInviteExpired
                              ? `Expired: ${new Date(invite.expiresAt).toLocaleDateString()}`
                              : `Expires: ${new Date(invite.expiresAt).toLocaleDateString()}`}
                        </span>
                     </div>
                     <div className="flex items-center gap-2 mt-2">
                        <Button
                           onClick={() => handleAcceptInvite(invite.id)}
                           disabled={isInviteProcessing || isInviteExpired}
                           variant="secondary"
                           className="flex-1"
                        >
                           {isInviteProcessing ? (
                              <Loader2 className="size-3 animate-spin" />
                           ) : (
                              <>
                                 <CheckCircle className="size-3" />
                                 Accept Invite
                              </>
                           )}
                        </Button>
                        <Button
                           variant="destructive"
                           className="flex-1"
                           onClick={() => handleRejectInvite(invite.id)}
                           disabled={isInviteRejecting}
                        >
                           {isInviteRejecting ? (
                              <Loader2 className="size-3 animate-spin" />
                           ) : (
                              <>
                                 <X className="size-3" />
                                 Reject Invite
                              </>
                           )}
                        </Button>
                     </div>
                  </CardContent>
               </Card>
            );
         })}
      </div>
   );
};

export default ReceivedInvites;
