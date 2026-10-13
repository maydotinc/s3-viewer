import Field from "@/components/form-field";
import { ModalShell } from "@/components/Modals/modal-shell";
import Reserve from "@/components/reserve";
import ServerListPagination from "@/components/server-list-pagination";
import useServers from "@/lib/hooks/queries/server/useServers";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { sharePath } from "@/lib/server-paths";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { DialogBody, DialogFooter } from "@s3-viewer/ui/components/dialog";
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

const InvitePeople = () => {
   const router = useRouter();
   const {
      servers,
      currentServer,
      isServerListLoading,
      hasNextPage,
      serverListError,
   } = useServers();
   const email = emailState(useInstanceConfig());
   const [open, setOpen] = useState(false);
   const [serverId, setServerId] = useState("");

   const label = (
      <>
         <UserRoundPlus aria-hidden="true" />
         Invite people
      </>
   );

   const manageable = servers.filter((server) =>
      hasPermission(server.userRole, Permission.MANAGE_MEMBERS)
   );
   if (
      email !== "enabled" ||
      isServerListLoading ||
      (manageable.length === 0 && !hasNextPage && !serverListError)
   ) {
      return (
         <Reserve show={false}>
            <Button>{label}</Button>
         </Reserve>
      );
   }

   const only =
      manageable.length === 1 && !hasNextPage && !serverListError
         ? manageable[0]
         : undefined;
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
         <ModalShell
            open={open}
            onClose={() => setOpen(false)}
            title="Invite people"
            description="Choose the server to share."
         >
            <DialogBody className="pt-1">
               <Field label="Server" htmlFor="invite-server" className="gap-2">
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
                  <ServerListPagination />
               </Field>
            </DialogBody>
            <DialogFooter>
               <Button
                  disabled={
                     !manageable.some((server) => server.id === serverId)
                  }
                  onClick={() => void router.push(sharePath(serverId))}
               >
                  Continue
               </Button>
            </DialogFooter>
         </ModalShell>
      </>
   );
};

export default InvitePeople;
