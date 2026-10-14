import Reserve from "@/components/reserve";
import useServers from "@/lib/hooks/queries/server/useServers";
import { SITE_PATHS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { canInviteTo } from "./manageable";

// the hub's primary action; it keeps its slot while the server list loads and hides for people who manage nothing
const InvitePeopleLink = () => {
   const {
      servers,
      isSessionPending,
      isServerListLoading,
      hasNextPage,
      serverListError,
   } = useServers();
   const show =
      !isSessionPending &&
      !isServerListLoading &&
      (servers.some(canInviteTo) || hasNextPage || serverListError !== null);
   const button = (
      <Button asChild>
         <Link href={SITE_PATHS.settingsInviteNew}>
            <UserRoundPlus aria-hidden="true" />
            Invite people
         </Link>
      </Button>
   );
   return show ? button : <Reserve show={false}>{button}</Reserve>;
};

export default InvitePeopleLink;
