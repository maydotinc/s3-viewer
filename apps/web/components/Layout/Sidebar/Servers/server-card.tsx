import { ROLE_LABELS } from "@s3-viewer/permissions";
import { ServerInfo } from "@s3-viewer/types";
import { ChevronsUpDown } from "lucide-react";
import ServerLogo from "./server-logo";

const ServerCard = ({ server }: { server: ServerInfo }) => (
   <span className="flex w-full flex-col gap-2 rounded-xl bg-viewergray p-2 text-left">
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

const ServerCardSkeleton = () => (
   <span
      aria-hidden="true"
      className="flex w-full flex-col gap-2 rounded-xl bg-viewergray p-2"
   >
      <span className="flex items-center gap-2">
         <span className="size-6 shrink-0 animate-pulse rounded-md bg-viewerborder" />
         <span className="h-5 w-28 animate-pulse rounded bg-viewerborder" />
         <span className="ml-auto size-7 rounded-full border border-viewerborder bg-viewerwhite" />
      </span>
      <span className="h-5 w-14 animate-pulse rounded bg-viewerborder" />
   </span>
);

export default ServerCard;
export { ServerCardSkeleton };
