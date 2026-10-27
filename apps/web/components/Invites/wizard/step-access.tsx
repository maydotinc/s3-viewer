import type { ServerInfo } from "@s3-viewer/shared";
import { useState } from "react";
import ServerAccessSection, {
   type AccessUpdate,
} from "./server-access-section";
import type { ServerBuckets } from "./useServerBuckets";
import type { ServerAccess } from "./wizard-state";

type StepAccessProps = {
   servers: readonly ServerInfo[];
   buckets: readonly ServerBuckets[];
   access: Readonly<Record<string, ServerAccess>>;
   expanded: string | null;
   submitted: boolean;
   focusRequest: number;
   onAccessChange: (
      serverId: string,
      fallback: ServerAccess,
      update: AccessUpdate
   ) => void;
   onExpand: (serverId: string) => void;
   onRemove: (serverId: string) => void;
};

// the first server still without a bucket is the one most likely to need attention
const defaultExpanded = (
   servers: readonly ServerInfo[],
   access: Readonly<Record<string, ServerAccess>>
): string | null =>
   (servers.find(({ id }) => !access[id]?.rows.length) ?? servers[0])?.id ??
   null;

const StepAccess = ({
   servers,
   buckets,
   access,
   expanded,
   submitted,
   focusRequest,
   onAccessChange,
   onExpand,
   onRemove,
}: StepAccessProps) => {
   const single = servers.length === 1;
   // decided once on entry: recomputing would collapse a section the moment its first bucket is checked
   const [fallback] = useState(() => defaultExpanded(servers, access));
   const listed = (id: string | null) =>
      id !== null && servers.some((server) => server.id === id) ? id : null;
   const open = listed(expanded) ?? listed(fallback) ?? servers[0]?.id ?? null;
   return (
      <div className="flex min-w-0 flex-col gap-3">
         {servers.map((server, index) => {
            const isOpen = single || server.id === open;
            return (
               <ServerAccessSection
                  key={server.id}
                  server={server}
                  access={access[server.id]}
                  buckets={buckets[index]!}
                  expanded={isOpen}
                  single={single}
                  submitted={submitted}
                  focusRequest={isOpen ? focusRequest : 0}
                  onAccessChange={onAccessChange}
                  onExpand={onExpand}
                  onRemove={onRemove}
               />
            );
         })}
      </div>
   );
};

export default StepAccess;
