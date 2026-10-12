import CenteredSpinner from "@/components/centered-spinner";
import ServerListPagination from "@/components/server-list-pagination";
import useServers from "@/lib/hooks/queries/server/useServers";
import { PRODUCT_NAME, Role } from "@s3-viewer/types";
import { Fragment } from "react";
import SettingsCard from "./card";

const ActivityRecordingCard = () => {
   const { servers, hasNextPage, serverListError, isServerListLoading } =
      useServers();
   const recording = servers.filter(
      (server) => server.audit.enabled && server.userRole !== Role.OWNER
   );
   const one = recording.length === 1;
   return (
      <SettingsCard title="Activity recording">
         <div className="flex min-h-10 flex-col items-start gap-3 break-words">
            {isServerListLoading ? (
               <CenteredSpinner
                  label="Loading activity recording settings"
                  className="min-h-10 self-stretch"
               />
            ) : recording.length === 0 && !hasNextPage && !serverListError ? (
               <p className="text-sm text-viewertext">
                  None of your shared servers record activity.
               </p>
            ) : null}
            {recording.length > 0 && (
               <p className="text-sm text-viewertext">
                  The owner of {one ? "this server" : "these servers"} records
                  what you do on {one ? "it" : "them"} through {PRODUCT_NAME}:{" "}
                  {recording.map((server, index) => (
                     <Fragment key={server.id}>
                        {index > 0 && ", "}
                        <span className="text-viewerblack">{server.name}</span>
                     </Fragment>
                  ))}
                  .
               </p>
            )}
            {hasNextPage && (
               <p className="text-sm text-viewertext">
                  Load more servers to check their activity recording settings.
               </p>
            )}
            <ServerListPagination />
         </div>
      </SettingsCard>
   );
};

export default ActivityRecordingCard;
