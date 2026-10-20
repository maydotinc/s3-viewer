import RelativeTime from "@/components/relative-time";
import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import QueryStatus from "@/components/query-status";
import RefreshButton from "@/components/refresh-button";
import { authClient } from "@/lib/auth";
import {
   useRevokeOtherSessions,
   useRevokeSession,
   useSessions,
   type Session,
} from "@/lib/hooks/queries/user/useSessions";
import { formatDay } from "@/lib/utils/format";
import { DAY_MS, SESSION_ABSOLUTE_TTL_DAYS } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { useState } from "react";
import SettingsCard from "./card";

const DESCRIPTION =
   "Devices signed in to your account. Sign out any you don't recognise.";

const ACTION_COLUMN =
   "col-start-2 row-span-2 row-start-1 flex w-20 shrink-0 justify-end";

const ROW =
   "grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 text-sm @xl:flex @xl:min-h-10";

// newest first, so the first row is usually this device: a badge and no sign-out button
const SessionsSkeleton = () => (
   <ul
      aria-busy="true"
      aria-label="Loading sessions"
      className="divide-y divide-viewerborder"
   >
      {[true, false].map((current, index) => (
         <li key={index} className={ROW}>
            <span className="flex min-w-0 flex-1 items-center gap-2">
               <span className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-24 max-w-full" />
               </span>
               {current && <Skeleton className="h-5.5 w-21 rounded-md" />}
            </span>
            <span className="col-start-1 row-start-2 flex h-5 items-center">
               <Skeleton className="h-3.5 w-36" />
            </span>
            <span className={ACTION_COLUMN}>
               {!current && (
                  <Skeleton className="h-8 w-19 rounded-lg pointer-coarse:h-11" />
               )}
            </span>
         </li>
      ))}
   </ul>
);

// the absolute cap is only enforced when that session's own cookie comes back, so its stored expiry can run past it
const endsAt = (session: Session): number =>
   Math.min(
      new Date(session.expiresAt).getTime(),
      new Date(session.createdAt).getTime() + SESSION_ABSOLUTE_TTL_DAYS * DAY_MS
   );

// the current session is live by definition (its cookie fetched the list), whatever the client clock says
const liveSessions = (
   sessions: readonly Session[] | undefined,
   currentId: string | undefined
): Session[] => {
   const now = Date.now();
   return (sessions ?? []).filter(
      (session) => session.id === currentId || endsAt(session) > now
   );
};

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
         Expires {formatDay(new Date(endsAt(session)).toISOString())}
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
   const live = liveSessions(sessions, currentId);
   const others = live.filter((session) => session.id !== currentId);

   const action = (
      <div className="flex shrink-0 items-center gap-2">
         <RefreshButton
            size="icon-sm"
            spinning={isFetching}
            onClick={() => void refetch()}
         />
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
      </div>
   );

   return (
      <SettingsCard title="Sessions" description={DESCRIPTION} action={action}>
         <div className="flex min-h-48 flex-col md:h-48 md:overflow-y-auto md:[scrollbar-gutter:stable]">
            <QueryStatus
               error={error}
               loading={!sessions}
               skeleton={<SessionsSkeleton />}
               title="Couldn't load your sessions"
               className="py-2"
               retrying={isFetching}
               onRetry={() => void refetch()}
            >
               <ul className="divide-y divide-viewerborder">
                  {live.map((session) => (
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
