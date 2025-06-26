import useRevokeInvite from "@/lib/hooks/mutations/useRevokeInvite";
import { useSentInvites } from "@/lib/hooks/queries/useServerInvites";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@s3-viewer/ui/components/card";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { Clock, Loader2, Mail, Server, Trash2, User } from "lucide-react";
import { useState } from "react";

const SentInvites: React.FC = () => {
   const { data: sentInvites = [], isLoading } = useSentInvites();
   const revokeInviteMutation = useRevokeInvite();
   const [processingInviteId, setProcessingInviteId] = useState<string | null>(
      null
   );

   const handleRevokeInvite = (inviteId: string) => {
      setProcessingInviteId(inviteId);
      revokeInviteMutation.mutate(
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

   if (sentInvites.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Mail className="size-12 text-viewerblue" />
            <h3 className="text-lg text-viewerblack">No invites sent</h3>
            <p className="text-viewertext">
               You haven't sent any server invitations yet.
            </p>
         </div>
      );
   }

   return (
      <div className="overflow-y-auto flex flex-col gap-2 max-h-[60vh]">
         {sentInvites.map((invite) => {
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
                        <div className="flex items-center gap-2">
                           <Badge
                              variant={
                                 isInviteExpired ? "destructive" : "secondary"
                              }
                           >
                              {invite.role}
                           </Badge>
                           {invite.accepted && (
                              <Badge
                                 variant="default"
                                 className="bg-green-100 text-green-800"
                              >
                                 Accepted
                              </Badge>
                           )}
                        </div>
                     </div>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col">
                     <div className="flex items-center gap-2 text-sm text-viewertext">
                        <User className="size-3" />
                        <span>Sent to {invite.email}</span>
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
                        onClick={() => handleRevokeInvite(invite.id)}
                        disabled={isInviteProcessing}
                        variant="destructive"
                        className="mt-2 w-full"
                     >
                        {isInviteProcessing ? (
                           <Loader2 className="size-3 animate-spin" />
                        ) : (
                           <>
                              <Trash2 className="size-3" />
                              Revoke Invite
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

export default SentInvites;
