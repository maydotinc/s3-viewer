import { ROLE_LABELS } from "@s3-viewer/permissions";
import { ServerInfo } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { ChevronsUpDown } from "lucide-react";
import ServerLogo from "./server-logo";

const CARD = "flex h-[74px] w-full flex-col gap-2 rounded-xl bg-viewergray p-2";

const ServerCard = ({ server }: { server: ServerInfo }) => (
   <span className={`${CARD} fade-in text-left`}>
      <span className="flex items-center gap-2">
         <ServerLogo provider={server.provider} />
         <span className="truncate font-semibold text-viewerblack">
            {server.name}
         </span>
         <span className="ml-auto rounded-full border border-viewerborder bg-viewerwhite p-1.5">
            <ChevronsUpDown
               aria-hidden="true"
               className="size-4 text-viewertext"
            />
         </span>
      </span>
      <span className="text-sm text-viewertext">
         {ROLE_LABELS[server.userRole]}
      </span>
   </span>
);

const ServerCardLoading = () => (
   <div className={`${CARD} items-center justify-center`}>
      <Spinner label="Loading servers" />
   </div>
);

export default ServerCard;
export { CARD as SERVER_CARD, ServerCardLoading };
