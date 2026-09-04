import useServers from "@/lib/hooks/queries/server/useServers";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogBody,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Label } from "@s3-viewer/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

const sharePath = (serverId: string) =>
   `/servers/${encodeURIComponent(serverId)}/share`;

const InvitePeople = () => {
   const router = useRouter();
   const { servers, currentServer } = useServers();
   const [open, setOpen] = useState(false);
   const [serverId, setServerId] = useState("");

   const manageable = servers.filter((server) =>
      hasPermission(server.userRole, Permission.MANAGE_MEMBERS)
   );
   if (manageable.length === 0) return null;

   const label = (
      <>
         <UserRoundPlus aria-hidden="true" />
         Invite people
      </>
   );

   const only = manageable.length === 1 ? manageable[0] : undefined;
   if (only) {
      return (
         <Button asChild>
            <Link href={sharePath(only.id)}>{label}</Link>
         </Button>
      );
   }

   const openPicker = () => {
      const current = manageable.find((s) => s.id === currentServer?.id);
      setServerId(current?.id ?? "");
      setOpen(true);
   };

   return (
      <>
         <Button onClick={openPicker}>{label}</Button>
         <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
               <DialogHeader>
                  <DialogTitle>Invite people</DialogTitle>
                  <DialogDescription>
                     Choose the server to share.
                  </DialogDescription>
               </DialogHeader>
               <DialogBody className="flex flex-col gap-2">
                  <Label htmlFor="invite-server">Server</Label>
                  <Select value={serverId} onValueChange={setServerId}>
                     <SelectTrigger id="invite-server">
                        <SelectValue placeholder="Choose a server" />
                     </SelectTrigger>
                     <SelectContent>
                        {manageable.map((server) => (
                           <SelectItem key={server.id} value={server.id}>
                              {server.name}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </DialogBody>
               <DialogFooter>
                  <Button
                     disabled={!serverId}
                     onClick={() => void router.push(sharePath(serverId))}
                  >
                     Continue
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </>
   );
};

export default InvitePeople;
