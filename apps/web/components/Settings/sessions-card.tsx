import RelativeTime from "@/components/relative-time";
import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import QueryStatus from "@/components/query-status";
import { authClient } from "@/lib/auth";
import {
   useRevokeOtherSessions,
   useRevokeSession,
   useSessions,
   type Session,
} from "@/lib/hooks/queries/user/useSessions";
import { formatDay } from "@/lib/utils/format";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import { useState } from "react";
import SettingsCard from "./card";

const DESCRIPTION =
   "Devices signed in to your account. Sign out any you don't recognise.";

const ACTION_COLUMN =
   "col-start-2 row-span-2 row-start-1 flex w-20 shrink-0 justify-end";

const ROW =
   "grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 text-sm @xl:flex @xl:min-h-10";

type SessionRowProps = {
   session: Session;
   isCurrent: boolean;
   revoke: ReturnType<typeof useRevokeSession>;
};

const SessionRow = ({ session, isCurrent, revoke }: SessionRowProps) => (
   <li className={ROW}>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
         <RelativeTime
            date={session.createdAt}
            prefix="Signed in "
            className="min-w-0 truncate text-viewerblack"
         />
         {isCurrent && <Badge className="shrink-0">This device</Badge>}
      </span>
      <span className="col-start-1 row-start-2 shrink-0 text-viewertext tabular-nums">
         Expires {formatDay(new Date(session.expiresAt).toISOString())}
      </span>
      <span className={ACTION_COLUMN}>
         {!isCurrent && (
            <Button
               type="button"
               variant="ghost"
               size="sm"
               loading={
                  revoke.isPending && revoke.variables?.token === session.token
               }
               disabled={revoke.isPending}
               onClick={() => revoke.mutate({ token: session.token })}
            >
               Sign out
            </Button>
         )}
      </span>
   </li>
);

const SessionsCard = () => {
   const {
      data: sessions,
      isLoading,
      isFetching,
      error,
      refetch,
   } = useSessions();
   const { data: current } = authClient.useSession();
   const revoke = useRevokeSession();
   const revokeOthers = useRevokeOtherSessions();
   const [confirming, setConfirming] = useState(false);

   const currentId = current?.session.id;
   const others = (sessions ?? []).filter(
      (session) => session.id !== currentId
   );

   const action = (
      <Button
         type="button"
         variant="outline"
         size="sm"
         disabled={
            isLoading ||
            Boolean(error) ||
            others.length === 0 ||
            revokeOthers.isPending
         }
         onClick={() => setConfirming(true)}
      >
         Sign out everywhere else
      </Button>
   );

   return (
      <SettingsCard title="Sessions" description={DESCRIPTION} action={action}>
         <div className="flex min-h-48 flex-col md:h-48 md:overflow-y-auto md:[scrollbar-gutter:stable]">
            <QueryStatus
               error={error}
               loading={!sessions}
               loadingLabel="Loading sessions"
               title="Couldn't load your sessions"
               className="py-2"
               retrying={isFetching}
               onRetry={() => void refetch()}
            >
               <ul className="divide-y divide-viewerborder">
                  {(sessions ?? []).map((session) => (
                     <SessionRow
                        key={session.id}
                        session={session}
                        isCurrent={session.id === currentId}
                        revoke={revoke}
                     />
                  ))}
               </ul>
            </QueryStatus>
         </div>
         {confirming && (
            <ConfirmDialog
               closable={!revokeOthers.isPending}
               onClose={() => setConfirming(false)}
               title="Sign out everywhere else"
               description="Every other device signed in to your account is signed out. This device stays signed in."
               confirmVariant="destructive"
               confirmLabel="Sign out everywhere else"
               isPending={revokeOthers.isPending}
               onConfirm={() =>
                  revokeOthers.mutate(undefined, {
                     onSuccess: () => setConfirming(false),
                  })
               }
            />
         )}
      </SettingsCard>
   );
};

export default SessionsCard;
