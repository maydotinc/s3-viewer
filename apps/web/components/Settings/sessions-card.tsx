import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { authClient } from "@/lib/auth";
import {
   useRevokeOtherSessions,
   useRevokeSession,
   useSessions,
   type Session,
} from "@/lib/hooks/queries/user/useSessions";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { formatDate, formatDay, formatRelativeDay } from "@/lib/utils/format";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { useState } from "react";
import SettingsCard from "./card";

const DESCRIPTION =
   "Devices signed in to your account. Sign out any you don't recognise.";

// the action column keeps its width on every row, so the current session's
// missing button does not pull the dates it sits beside out of line
const ACTION_COLUMN = "flex w-24 shrink-0 justify-end";

const ROW = "flex h-10 items-center gap-3 text-sm";

const SignedIn = ({ createdAt }: { createdAt: Date | string }) => {
   const hydrated = useHydrated();
   const iso = new Date(createdAt).toISOString();
   // relative times depend on the clock, so nothing renders until hydration
   if (!hydrated) return <span>&nbsp;</span>;
   return (
      <SimpleTooltip label={formatDate(iso)}>
         <span tabIndex={0} className="min-w-0 truncate text-viewerblack">
            Signed in {formatRelativeDay(iso)}
         </span>
      </SimpleTooltip>
   );
};

type SessionRowProps = {
   session: Session;
   isCurrent: boolean;
   revoke: ReturnType<typeof useRevokeSession>;
};

const SessionRow = ({ session, isCurrent, revoke }: SessionRowProps) => (
   <li className={ROW}>
      <span className="flex min-w-0 flex-1 items-center gap-2">
         <SignedIn createdAt={session.createdAt} />
         {isCurrent && (
            <Badge variant="secondary" className="shrink-0">
               This device
            </Badge>
         )}
      </span>
      <span className="shrink-0 text-viewertext tabular-nums">
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

const SkeletonRows = () => (
   <ul aria-busy="true" className="divide-y divide-viewerborder">
      {[0, 1, 2].map((row) => (
         <li key={row} className={ROW}>
            <Skeleton className="h-3.5 w-40 flex-1" />
            <Skeleton className="h-3.5 w-32" />
            <span className={ACTION_COLUMN} />
         </li>
      ))}
   </ul>
);

const SessionsCard = () => {
   const { data: sessions, isLoading, error } = useSessions();
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
         disabled={isLoading || others.length === 0 || revokeOthers.isPending}
         onClick={() => setConfirming(true)}
      >
         Sign out everywhere else
      </Button>
   );

   return (
      <SettingsCard
         title="Sessions"
         description={DESCRIPTION}
         action={error ? undefined : action}
      >
         {error ? (
            <p className="text-sm text-viewertextred">{error.message}</p>
         ) : isLoading ? (
            <SkeletonRows />
         ) : sessions && sessions.length > 0 ? (
            <ul className="max-h-64 divide-y divide-viewerborder overflow-y-auto">
               {sessions.map((session) => (
                  <SessionRow
                     key={session.id}
                     session={session}
                     isCurrent={session.id === currentId}
                     revoke={revoke}
                  />
               ))}
            </ul>
         ) : (
            <p className="text-sm text-viewertext">No active sessions.</p>
         )}
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
