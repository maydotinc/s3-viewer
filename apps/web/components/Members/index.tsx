import QueryStatus from "@/components/query-status";
import Reserve from "@/components/reserve";
import ServerListPagination from "@/components/server-list-pagination";
import SettingsCard from "@/components/Settings/card";
import StatusMessage from "@/components/status-message";
import useBucketsForServer from "@/lib/hooks/queries/s3/useBucketsForServer";
import useServers from "@/lib/hooks/queries/server/useServers";
import { invitePeoplePath, membersPath } from "@/lib/server-paths";
import { useUserId } from "@/lib/stores/session-store";
import { manageableServers } from "@/components/Invites/manageable";
import { SITE_PATHS, type ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { ShieldOff, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";
import MembersTabs from "./members-tabs";
import ServerPicker from "./server-picker";

const CARD = {
   title: "Members",
   description: "Manage who has access to your servers.",
};

const find = (servers: readonly ServerInfo[], id: string | null | undefined) =>
   id ? servers.find((server) => server.id === id) : undefined;

const MembersSettings = () => {
   const router = useRouter();
   const userId = useUserId();
   const {
      servers,
      currentServer,
      isSessionPending,
      isServerListLoading,
      serverListError,
      hasNextPage,
      isFetching,
      refetch,
   } = useServers();
   const manageable = useMemo(() => manageableServers(servers), [servers]);
   const requested =
      typeof router.query.server === "string" ? router.query.server : null;
   // ?server may name a server the current-server lookup never sees, so selection waits for the list and the query
   const loading = !router.isReady || isSessionPending || isServerListLoading;
   const selected = loading
      ? null
      : (find(manageable, requested) ??
        find(manageable, currentServer?.id) ??
        manageable[0] ??
        null);
   const selectedId = selected?.id ?? "";

   useEffect(() => {
      if (!selectedId || selectedId === requested) return;
      void router.replace(membersPath(selectedId), undefined, {
         shallow: true,
      });
   }, [requested, router, selectedId]);

   const { buckets, isLoading: isBucketsLoading } = useBucketsForServer(
      userId,
      selectedId
   );

   if (!loading && manageable.length === 0 && !hasNextPage) {
      return (
         <SettingsCard flush {...CARD}>
            {serverListError ? (
               <QueryStatus
                  error={serverListError}
                  title="Couldn't load your servers"
                  className="min-h-72"
                  retrying={isFetching}
                  onRetry={() => void refetch()}
               />
            ) : (
               <StatusMessage
                  icon={ShieldOff}
                  title="No servers to manage"
                  className="min-h-72"
                  actions={
                     <Button variant="outline" asChild>
                        <Link href={SITE_PATHS.dashboard}>
                           Back to dashboard
                        </Link>
                     </Button>
                  }
               >
                  You can manage members on servers where you&apos;re an Owner
                  or Admin.
               </StatusMessage>
            )}
         </SettingsCard>
      );
   }

   return (
      <div className="flex min-w-0 flex-col gap-4">
         <div className="flex min-h-9 min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 max-sm:basis-full">
               <ServerPicker
                  servers={manageable}
                  selected={selected}
                  loading={loading}
                  onChange={(serverId) =>
                     void router.replace(membersPath(serverId), undefined, {
                        shallow: true,
                     })
                  }
               />
               {!loading && (
                  <div className="min-w-0 empty:hidden">
                     <ServerListPagination />
                  </div>
               )}
            </div>
            <Reserve
               show={loading || Boolean(selected)}
               className="inline-flex"
            >
               {selected ? (
                  <Button variant="outline" asChild>
                     <Link href={invitePeoplePath(selected.id)}>
                        <UserRoundPlus aria-hidden="true" />
                        Invite people
                     </Link>
                  </Button>
               ) : (
                  <Button variant="outline" disabled>
                     <UserRoundPlus aria-hidden="true" />
                     Invite people
                  </Button>
               )}
            </Reserve>
         </div>
         <MembersTabs
            serverId={selectedId}
            myRole={selected?.userRole ?? null}
            buckets={buckets}
            isBucketsLoading={isBucketsLoading}
         />
      </div>
   );
};

export default MembersSettings;
