import { useHydrated } from "@/lib/hooks/useHydrated";
import { formatDate, formatRelativeDay } from "@/lib/utils/format";
import type { AuditAction, AuditLogEntry } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { History } from "lucide-react";
import { EmptyRow } from "./table-states";

type ActivityProps = {
   entries: AuditLogEntry[];
   isLoading: boolean;
   hasNextPage: boolean;
   isFetchingNextPage: boolean;
   onLoadMore: () => void;
};

const COLUMNS = 4;

// every action the log can hold, in the words a person reading it would use.
// The map is exhaustive on purpose: a new `AuditAction` fails to compile until
// it has been given a sentence here.
const ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
   "server.create": "Connected the server",
   "server.rename": "Renamed the server",
   "server.delete": "Deleted the server connection",
   "server.leave": "Left the server",
   "credentials.update": "Updated the server credentials",
   "member.role_change": "Changed a member's role",
   "member.remove": "Removed a member",
   "invite.send": "Sent an invite",
   "invite.revoke": "Revoked an invite",
   "invite.accept": "Accepted an invite",
   "invite.reject": "Rejected an invite",
   "bucket.create": "Created a bucket",
   "bucket.remove": "Removed a bucket",
   "object.delete": "Deleted objects",
   "object.rename": "Renamed an object",
   "account.delete": "Deleted their account",
   "account.verify": "Verified their email",
   "auth.sign_in": "Signed in",
   "auth.sign_in_failed": "Failed a sign-in",
   "auth.sign_up": "Created an account",
   "auth.sign_up_refused": "Was refused a sign-up",
   "auth.sign_out": "Signed out",
   "auth.password_change": "Changed their password",
   "auth.password_reset": "Reset their password",
   "auth.password_set": "Set a password",
   "auth.sessions_revoked": "Signed out other devices",
};

// the row keeps the actor's id, so a name the account no longer has is the one
// thing the log cannot show
const DELETED_ACTOR = "Deleted user";

const Actor = ({ entry }: { entry: AuditLogEntry }) => {
   const name = entry.actorName ?? entry.actorEmail;
   if (!name)
      return <span className="text-viewerlighttext">{DELETED_ACTOR}</span>;
   if (!entry.actorEmail || entry.actorEmail === name)
      return <span className="min-w-0 truncate">{name}</span>;
   return (
      <SimpleTooltip label={entry.actorEmail}>
         <span tabIndex={0} className="min-w-0 truncate">
            {name}
         </span>
      </SimpleTooltip>
   );
};

const When = ({ createdAt }: { createdAt: string }) => {
   const hydrated = useHydrated();
   // relative times depend on the clock, so nothing renders until hydration
   if (!hydrated) return <span>&nbsp;</span>;
   return (
      <SimpleTooltip label={formatDate(createdAt)}>
         <span tabIndex={0} className="text-viewertext">
            {formatRelativeDay(createdAt)}
         </span>
      </SimpleTooltip>
   );
};

const SkeletonRows = () =>
   [0, 1, 2, 3].map((row) => (
      <TableRow key={row} className="hover:bg-transparent">
         <TableCell className="px-6">
            <Skeleton className="h-3.5 w-32" />
         </TableCell>
         <TableCell>
            <Skeleton className="h-3.5 w-44" />
         </TableCell>
         <TableCell>
            <Skeleton className="h-3.5 w-40" />
         </TableCell>
         <TableCell>
            <Skeleton className="h-3.5 w-20" />
         </TableCell>
      </TableRow>
   ));

const Activity = ({
   entries,
   isLoading,
   hasNextPage,
   isFetchingNextPage,
   onLoadMore,
}: ActivityProps) => (
   <>
      <Table className="min-w-[720px] table-fixed">
         <TableHeader>
            <TableRow>
               <TableHead className="w-48 px-6">Person</TableHead>
               <TableHead className="w-56">Action</TableHead>
               <TableHead>Details</TableHead>
               <TableHead className="w-36">When</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {isLoading ? (
               <SkeletonRows />
            ) : entries.length === 0 ? (
               <EmptyRow colSpan={COLUMNS} icon={History}>
                  Nothing has happened on this server yet
               </EmptyRow>
            ) : (
               entries.map((entry) => (
                  <TableRow key={entry.id}>
                     <TableCell className="min-w-0 px-6 text-viewerblack">
                        <Actor entry={entry} />
                     </TableCell>
                     <TableCell className="min-w-0 truncate text-viewerblack">
                        {ACTION_LABELS[entry.action]}
                     </TableCell>
                     <TableCell className="min-w-0 truncate text-viewertext">
                        {entry.target ?? "—"}
                     </TableCell>
                     <TableCell>
                        <When createdAt={entry.createdAt} />
                     </TableCell>
                  </TableRow>
               ))
            )}
         </TableBody>
      </Table>
      {hasNextPage && (
         <div className="flex h-12 items-center justify-center border-t border-viewerborder">
            <Button
               type="button"
               variant="ghost"
               size="sm"
               loading={isFetchingNextPage}
               onClick={onLoadMore}
            >
               Load more
            </Button>
         </div>
      )}
   </>
);

export default Activity;
export { ACTION_LABELS };
