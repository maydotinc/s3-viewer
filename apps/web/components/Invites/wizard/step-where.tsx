import { CellBar } from "@/components/DataGrid/skeleton";
import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import ListPagination, {
   type LoadMoreQuery,
} from "@/components/list-pagination";
import QueryStatus from "@/components/query-status";
import StatusMessage from "@/components/status-message";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { SITE_PATHS, type ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ServerIcon } from "lucide-react";
import Link from "next/link";
import { memo, useId } from "react";

type StepWhereProps = {
   servers: readonly ServerInfo[];
   selected: ReadonlySet<string>;
   loading: boolean;
   pages: LoadMoreQuery;
   disabled?: boolean;
   onToggle: (serverId: string, checked: boolean) => void;
   onSelectAll: (serverIds: readonly string[]) => void;
};

const ROW = "flex h-12 items-center gap-3 px-3";

const SKELETON_ROWS = 3;

const ServerRow = memo(function ServerRow({
   id,
   server,
   checked,
   disabled,
   onToggle,
}: {
   id: string;
   server: ServerInfo;
   checked: boolean;
   disabled?: boolean;
   onToggle: (serverId: string, checked: boolean) => void;
}) {
   return (
      <li>
         <label
            htmlFor={id}
            className={cn(ROW, "cursor-pointer hover:bg-viewergray/60")}
         >
            <Checkbox
               id={id}
               checked={checked}
               disabled={disabled}
               onCheckedChange={(next) => onToggle(server.id, next === true)}
            />
            <ServerLogo provider={server.provider} />
            <span className="flex min-w-0 flex-1 flex-col">
               <span className="truncate text-sm text-viewerblack">
                  {server.name}
               </span>
               <span className="text-xs text-viewerlighttext">
                  {ROLE_LABELS[server.userRole]}
               </span>
            </span>
         </label>
      </li>
   );
});

const StepWhere = ({
   servers,
   selected,
   loading,
   pages,
   disabled,
   onToggle,
   onSelectAll,
}: StepWhereProps) => {
   const rowId = useId();
   const allSelected =
      servers.length > 0 && servers.every((server) => selected.has(server.id));
   const empty =
      !loading && servers.length === 0 && !pages.hasNextPage && !pages.error;
   const failed = !loading && servers.length === 0 ? pages.error : null;
   const canToggleAll = !loading && servers.length > 0;

   return (
      <div className="flex min-w-0 flex-col gap-2">
         <div className="flex h-5 items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-viewerblack">Servers</h3>
            <Button
               type="button"
               variant="link"
               size="sm"
               className={cn("h-auto px-0", !canToggleAll && "invisible")}
               disabled={disabled || !canToggleAll}
               aria-hidden={!canToggleAll || undefined}
               tabIndex={canToggleAll ? undefined : -1}
               onClick={() =>
                  onSelectAll(
                     allSelected ? [] : servers.map((server) => server.id)
                  )
               }
            >
               {allSelected ? "Clear" : "Select all"}
            </Button>
         </div>
         <ul
            role="group"
            aria-label="Servers to invite to"
            aria-busy={loading || undefined}
            className="flex min-h-36 flex-col divide-y divide-viewerborder rounded-lg border border-viewerborder"
         >
            {loading ? (
               Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <li key={index} aria-hidden="true" className={ROW}>
                     <Skeleton className="size-4 shrink-0 rounded" />
                     <Skeleton className="size-6 shrink-0 rounded-md" />
                     <span className="flex flex-col gap-1.5">
                        <CellBar className="w-40" />
                        <CellBar className="h-3 w-12" />
                     </span>
                  </li>
               ))
            ) : empty ? (
               <li className="flex flex-1 flex-col">
                  <StatusMessage
                     icon={ServerIcon}
                     title="No servers you can invite to"
                     actions={
                        <Button variant="outline" asChild>
                           <Link href={SITE_PATHS.dashboard}>
                              Back to dashboard
                           </Link>
                        </Button>
                     }
                  >
                     You need to be an Owner or Admin of a server to invite
                     people to it.
                  </StatusMessage>
               </li>
            ) : failed ? (
               <li className="flex flex-1 flex-col">
                  <QueryStatus
                     error={failed}
                     title="Couldn't load your servers"
                     retrying={pages.isFetching}
                     onRetry={() =>
                        void pages.refetch({ cancelRefetch: false })
                     }
                  />
               </li>
            ) : (
               servers.map((server) => (
                  <ServerRow
                     key={server.id}
                     id={`${rowId}-${server.id}`}
                     server={server}
                     checked={selected.has(server.id)}
                     disabled={disabled}
                     onToggle={onToggle}
                  />
               ))
            )}
         </ul>
         <p className="min-h-5 text-xs leading-5 text-viewerlighttext">
            Only servers where you&apos;re an Owner or Admin are listed.
         </p>
         <div className="flex min-h-8 items-center">
            {!failed && (
               <ListPagination
                  {...pages}
                  label="Load more servers"
                  disabled={disabled}
               />
            )}
         </div>
      </div>
   );
};

export default StepWhere;
