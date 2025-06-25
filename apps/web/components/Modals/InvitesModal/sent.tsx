import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@s3-viewer/ui/components/card";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { Clock, Mail, Server, Trash2, User } from "lucide-react";
import { useState } from "react";
import { useInvitesContext } from "./context/InvitesContext";

const SentInvites: React.FC = () => {
   const { sentInvites, isLoading, revokeInvite } = useInvitesContext();
   const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

   const handleRevokeInvite = async (inviteId: string) => {
      setRevokingInviteId(inviteId);
      try {
         await revokeInvite(inviteId);
      } catch (error) {
         console.error("Failed to revoke invite:", error);
      } finally {
         setRevokingInviteId(null);
      }
   };

   const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString();
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

   if (sentInvites.length === 0) {
      return (
         <div className="text-center py-8">
            <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No invites sent</h3>
            <p className="text-gray-500">You haven't sent any server invitations yet.</p>
         </div>
      );
   }

   return (
      <div className="space-y-4 max-h-96 overflow-y-auto">
         {sentInvites.map((invite) => (
            <Card key={invite.id} className="relative">
               <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                     <CardTitle className="text-base flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        {invite.server.name}
                     </CardTitle>
                     <div className="flex items-center gap-2">
                        <Badge variant={isExpired(invite.expiresAt) ? "destructive" : "secondary"}>
                           {invite.role}
                        </Badge>
                        {invite.accepted && (
                           <Badge variant="default" className="bg-green-100 text-green-800">
                              Accepted
                           </Badge>
                        )}
                     </div>
                  </div>
               </CardHeader>
               <CardContent>
                  <div className="space-y-2">
                     <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="h-3 w-3" />
                        <span>Invited: {invite.email}</span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>Sent on {formatDate(invite.createdAt)}</span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>
                           {isExpired(invite.expiresAt)
                              ? `Expired on ${formatDate(invite.expiresAt)}`
                              : `Expires on ${formatDate(invite.expiresAt)}`}
                        </span>
                     </div>
                     <div className="pt-2">
                        {invite.accepted ? (
                           <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                              ✓ Invitation Accepted
                           </Badge>
                        ) : isExpired(invite.expiresAt) ? (
                           <Badge variant="destructive" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Expired
                           </Badge>
                        ) : (
                           <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevokeInvite(invite.id)}
                              disabled={revokingInviteId === invite.id}
                              className="text-xs"
                           >
                              {revokingInviteId === invite.id ? (
                                 "Revoking..."
                              ) : (
                                 <>
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Revoke Invite
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

export default SentInvites;
