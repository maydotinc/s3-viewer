import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@s3-viewer/ui/components/tabs-slider";
import { UserRoundPlus } from "lucide-react";
import ReceivedInvites from "./received";
import SentInvites from "./sent";

const Invites = () => {
   const { openShareModal } = useModalContext();
   const { currentServer } = useServers();
   const canManage = usePermission(Permission.MANAGE_MEMBERS);

   return (
      <div className="flex size-full flex-col bg-viewerwhite">
         <header className="flex min-h-[var(--header-height)] items-center justify-between gap-4 border-b border-viewerborder px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col">
               <h1 className="text-heading">Invites</h1>
               <p className="text-sm text-viewertext">
                  Invites you&apos;ve received
                  {canManage &&
                     currentServer &&
                     `, and ones sent for ${currentServer.name}`}
                  .
               </p>
            </div>
            {canManage && currentServer && (
               <Button
                  onClick={() => openShareModal({ server: currentServer })}
               >
                  <UserRoundPlus aria-hidden="true" />
                  Invite members
               </Button>
            )}
         </header>
         <section className="flex w-full flex-1 flex-col overflow-y-auto p-4 sm:p-6 lg:p-8">
            {canManage && currentServer ? (
               <Tabs defaultValue="received" className="flex flex-col gap-4">
                  <TabsList className="w-full">
                     <TabsTrigger value="received">Received</TabsTrigger>
                     <TabsTrigger value="sent">Sent</TabsTrigger>
                  </TabsList>
                  <TabsContent value="received">
                     <ReceivedInvites />
                  </TabsContent>
                  <TabsContent value="sent">
                     <SentInvites serverId={currentServer.id} />
                  </TabsContent>
               </Tabs>
            ) : (
               <ReceivedInvites />
            )}
         </section>
      </div>
   );
};

export default Invites;
