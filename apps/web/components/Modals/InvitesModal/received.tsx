import useAcceptInvite from "@/lib/hooks/mutations/useAcceptInvite";
import { useReceivedInvites } from "@/lib/hooks/queries/useServerInvites";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@s3-viewer/ui/components/card";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { CheckCircle, Clock, Loader2, Mail, Server, User } from "lucide-react";
import { useState } from "react";

const ReceivedInvites: React.FC = () => {
   const { data: receivedInvites = [], isLoading } = useReceivedInvites();
   const acceptInviteMutation = useAcceptInvite();
   const [processingInviteId, setProcessingInviteId] = useState<string | null>(
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

   const isExpired = (expiresAt: string) => {
      return new Date(expiresAt) < new Date();
   };

   if (isLoading) {
      return (
         <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
               <div
                  key={i}
                  className="flex flex-col gap-2 border border-viewerborder rounded-md p-2"
               >
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-8 w-20" />
               </div>
            ))}
         </div>
      );
   }

   if (receivedInvites.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Mail className="size-12 text-viewerblue" />
            <h3 className="text-lg text-viewerblack">No invites received</h3>
            <p className="text-viewertext">
               You don't have any pending server invitations.
            </p>
         </div>
      );
   }

   return (
      <div className="overflow-y-auto flex flex-col gap-2 max-h-[60vh]">
         {receivedInvites.map((invite) => {
            const isInviteProcessing = processingInviteId === invite.id;
            const isInviteExpired = isExpired(invite.expiresAt);

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
                     <Button
                        onClick={() => handleAcceptInvite(invite.id)}
                        disabled={isInviteProcessing || isInviteExpired}
                        variant={isInviteExpired ? "destructive" : "secondary"}
                        className="mt-2 w-fit"
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
                  </CardContent>
               </Card>
            );
         })}
      </div>
   );
};

export default ReceivedInvites;
