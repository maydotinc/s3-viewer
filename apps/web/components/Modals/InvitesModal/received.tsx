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
import { CheckCircle, Clock, Mail, Server, User } from "lucide-react";

const ReceivedInvites: React.FC = () => {
   const { data: receivedInvites = [], isLoading } = useReceivedInvites();
   const acceptInviteMutation = useAcceptInvite();

   const handleAcceptInvite = (inviteId: string) => {
      acceptInviteMutation.mutate({ inviteId });
   };

   const isExpired = (expiresAt: string) => {
      return new Date(expiresAt) < new Date();
   };

   if (isLoading) {
      return (
         <div className="space-y-4">
            {[1, 2, 3].map((i) => (
               <Card key={i}>
                  <CardHeader className="pb-2">
                     <Skeleton className="h-4 w-3/4" />
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-2">
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-8 w-20" />
                     </div>
                  </CardContent>
               </Card>
            ))}
         </div>
      );
   }

   if (receivedInvites.length === 0) {
      return (
         <div className="text-center py-8">
            <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
               No invites received
            </h3>
            <p className="text-gray-500">
               You don't have any pending server invitations.
            </p>
         </div>
      );
   }

   return (
      <div className="space-y-4 max-h-96 overflow-y-auto">
         {receivedInvites.map((invite) => (
            <Card key={invite.id} className="relative">
               <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                     <CardTitle className="text-base flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        {invite.server.name}
                     </CardTitle>
                     <Badge
                        variant={
                           isExpired(invite.expiresAt)
                              ? "destructive"
                              : "secondary"
                        }
                     >
                        {invite.role}
                     </Badge>
                  </div>
               </CardHeader>
               <CardContent>
                  <div className="space-y-2">
                     {invite.invitedBy && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                           <User className="h-3 w-3" />
                           <span>Invited by {invite.invitedBy.name}</span>
                        </div>
                     )}
                     <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>
                           {isExpired(invite.expiresAt)
                              ? `Expired on ${new Date(invite.expiresAt).toLocaleDateString()}`
                              : `Expires on ${new Date(invite.expiresAt).toLocaleDateString()}`}
                        </span>
                     </div>
                     <div className="pt-2">
                        {isExpired(invite.expiresAt) ? (
                           <Badge variant="destructive" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Expired
                           </Badge>
                        ) : (
                           <Button
                              size="sm"
                              onClick={() => handleAcceptInvite(invite.id)}
                              disabled={acceptInviteMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                           >
                              {acceptInviteMutation.isPending ? (
                                 "Accepting..."
                              ) : (
                                 <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Accept Invite
                                 </>
                              )}
                           </Button>
                        )}
                     </div>
                  </div>
               </CardContent>
            </Card>
         ))}
      </div>
   );
};

export default ReceivedInvites;
