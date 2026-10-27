import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import type { ServerInfo } from "@s3-viewer/shared";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";

const WIDTH = "w-full sm:w-72";

type ServerPickerProps = {
   servers: readonly ServerInfo[];
   selected: ServerInfo | null;
   loading: boolean;
   onChange: (serverId: string) => void;
};

const ServerPicker = ({
   servers,
   selected,
   loading,
   onChange,
}: ServerPickerProps) => {
   if (loading)
      return (
         <Skeleton className={`h-9 rounded-lg pointer-coarse:h-11 ${WIDTH}`} />
      );
   return (
      <Select value={selected?.id ?? ""} onValueChange={onChange}>
         <SelectTrigger aria-label="Server" className={WIDTH}>
            <SelectValue placeholder="Choose a server">
               {selected && (
                  <span className="flex min-w-0 items-center gap-2.5">
                     <ServerLogo provider={selected.provider} />
                     <span
                        title={selected.name}
                        className="min-w-0 truncate text-viewerblack"
                     >
                        {selected.name}
                     </span>
                     <span className="shrink-0 text-xs text-viewerlighttext">
                        {ROLE_LABELS[selected.userRole]}
                     </span>
                  </span>
               )}
            </SelectValue>
         </SelectTrigger>
         <SelectContent>
            {servers.map((server) => (
               <SelectItem
                  key={server.id}
                  value={server.id}
                  textValue={server.name}
                  description={ROLE_LABELS[server.userRole]}
               >
                  <span className="flex min-w-0 items-center gap-2.5">
                     <ServerLogo provider={server.provider} />
                     <span className="min-w-0 truncate">{server.name}</span>
                  </span>
               </SelectItem>
            ))}
         </SelectContent>
      </Select>
   );
};

export default ServerPicker;
