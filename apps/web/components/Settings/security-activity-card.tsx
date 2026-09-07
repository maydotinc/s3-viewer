import { ACTION_LABELS } from "@/components/Share/activity";
import useSecurityActivity from "@/lib/hooks/queries/user/useSecurityActivity";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { formatDate, formatRelativeDay } from "@/lib/utils/format";
import type { AuditLogEntry } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import SettingsCard from "./card";

const DESCRIPTION =
   "Recent sign-ins and account changes. Anything you don't recognise is worth a password change.";

const ROW = "flex h-10 items-center gap-3 text-sm";

// only the sign-in rows carry a method in `target`; everything else stores an
// id or a count that means nothing on your own account page
const METHODS: Readonly<Record<string, string>> = {
   password: "Password",
   github: "GitHub",
};

const methodOf = (entry: AuditLogEntry): string | null =>
   entry.action === "auth.sign_in" || entry.action === "auth.sign_in_failed"
      ? (METHODS[entry.target ?? ""] ?? null)
      : null;

const When = ({ createdAt }: { createdAt: string }) => {
   const hydrated = useHydrated();
   // relative times depend on the clock, so nothing renders until hydration
   if (!hydrated) return <span>&nbsp;</span>;
   return (
      <SimpleTooltip label={formatDate(createdAt)}>
         <span tabIndex={0} className="shrink-0 text-viewertext">
            {formatRelativeDay(createdAt)}
         </span>
      </SimpleTooltip>
   );
};

const SkeletonRows = () => (
   <ul aria-busy="true" className="divide-y divide-viewerborder">
      {[0, 1, 2].map((row) => (
         <li key={row} className={ROW}>
            <Skeleton className="h-3.5 w-44 flex-1" />
            <Skeleton className="h-3.5 w-20" />
         </li>
      ))}
   </ul>
);

const SecurityActivityCard = () => {
   const {
      entries,
      isLoading,
      error,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
   } = useSecurityActivity();

   return (
      <SettingsCard title="Security activity" description={DESCRIPTION}>
         {error ? (
            <p className="text-sm text-viewertextred">{error.message}</p>
         ) : isLoading ? (
            <SkeletonRows />
         ) : entries.length === 0 ? (
            <p className="text-sm text-viewertext">
               Nothing has happened on this account yet.
            </p>
         ) : (
            <ul className="max-h-64 divide-y divide-viewerborder overflow-y-auto">
               {entries.map((entry) => {
                  const method = methodOf(entry);
                  return (
                     <li key={entry.id} className={ROW}>
                        <span className="min-w-0 flex-1 truncate text-viewerblack">
                           {ACTION_LABELS[entry.action]}
                           {method && (
                              <span className="text-viewertext">
                                 {" · "}
                                 {method}
                              </span>
                           )}
                        </span>
                        <When createdAt={entry.createdAt} />
                     </li>
                  );
               })}
            </ul>
         )}
         {hasNextPage && !error && (
            <Button
               type="button"
               variant="ghost"
               size="sm"
               className="self-start"
               loading={isFetchingNextPage}
               onClick={() => void fetchNextPage()}
            >
               Show more
            </Button>
         )}
      </SettingsCard>
   );
};

export default SecurityActivityCard;
