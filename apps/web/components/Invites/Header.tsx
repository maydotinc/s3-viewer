import { useModalContext } from "@/lib/contexts/ModalContext";
import useSessionStore from "@/lib/stores/sessionStore";
import { Button } from "@s3-viewer/ui/components/button";
import { UserRoundPlus } from "lucide-react";
import useServers from "@/lib/hooks/queries/server/useServers";

const InvitesHeader = () => {
   const { openShareModal } = useModalContext();
   const { currentServer } = useServers();
   const serverId = useSessionStore((state) => state.serverId);

   return (
      <div className="w-full box-border border-b flex border-viewerborder bg-viewerwhite px-8 py-4 gap-4 justify-between items-center min-h-[var(--header-height)]">
         <div className="flex flex-col max-md:hidden">
            <span className="text-viewerblack text-lg font-semibold leading-none">
               Manage Invites
            </span>
            <span className="text-viewertext text-md">
               Manage all of your sent and received server invites.
            </span>
         </div>
         {serverId && (
            <Button onClick={() => openShareModal({ server: currentServer ?? undefined })}>
               <UserRoundPlus className="size-4" />
               Invite Members
            </Button>
         )}
      </div>
   );
};

export default InvitesHeader;
