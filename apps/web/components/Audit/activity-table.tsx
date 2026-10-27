import { EmptyRow } from "@/components/Layout/table-states";
import RelativeTime from "@/components/relative-time";
import TableSkeletonRows from "@/components/table-skeleton";
import { visibleText } from "@/lib/utils/format";
import type { AuditAccess, AuditLogEntry } from "@s3-viewer/shared";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { History } from "lucide-react";
import { memo, type ReactNode } from "react";
import { ACTION_LABELS, metaOf, targetOf } from "./labels";

const COLUMNS = 4;

const SKELETON_COLUMNS = [{}, {}, {}, { align: "right" }] as const;

const emptyMessage = (audit: AuditAccess, filtered: boolean): string =>
   filtered
      ? "No activity matches these filters."
      : audit.enabled
        ? "Nothing has been recorded yet."
        : audit.canManage
          ? "The audit log is off. Turn it on under Settings."
          : "The audit log is off for this server.";

const shown = (text: string | null): string | null =>
   text ? visibleText(text) : null;

const ActivityRow = ({ entry }: { entry: AuditLogEntry }) => {
   const target = shown(targetOf(entry));
   const meta = shown(metaOf(entry));
   const details = [target, meta].filter(Boolean).join(" ");
   return (
      <TableRow>
         <TableCell title={entry.actorEmail} className="min-w-0 truncate px-6">
            {entry.actorEmail}
         </TableCell>
         <TableCell
            title={ACTION_LABELS[entry.action]}
            className="min-w-0 truncate"
         >
            {ACTION_LABELS[entry.action]}
         </TableCell>
         <TableCell title={details || undefined} className="min-w-0 truncate">
            <span className="text-viewerblack">{target ?? meta ?? "—"}</span>
            {target && meta && (
               <span className="ml-2 text-xs text-viewerlighttext">{meta}</span>
            )}
         </TableCell>
         <TableCell className="text-right tabular-nums">
            <RelativeTime date={entry.createdAt} className="text-viewertext" />
         </TableCell>
      </TableRow>
   );
};

type ActivityRowsProps = {
   entries: readonly AuditLogEntry[];
   audit: AuditAccess;
   filtered: boolean;
};

const ActivityRows = memo(function ActivityRows({
   entries,
   audit,
   filtered,
}: ActivityRowsProps) {
   return (
      <TableBody>
         {entries.length === 0 ? (
            <EmptyRow colSpan={COLUMNS} icon={History}>
               {emptyMessage(audit, filtered)}
            </EmptyRow>
         ) : (
            entries.map((entry) => <ActivityRow key={entry.id} entry={entry} />)
         )}
      </TableBody>
   );
});

const ActivityTable = ({ children }: { children: ReactNode }) => (
   <Table className="min-w-[720px] table-fixed">
      <TableHeader>
         <TableRow>
            <TableHead className="w-44 px-6 @4xl:w-56">Person</TableHead>
            <TableHead className="w-36 @4xl:w-48">Action</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="w-36 text-right tabular-nums">When</TableHead>
         </TableRow>
      </TableHeader>
      {children}
   </Table>
);

const ActivitySkeleton = () => (
   <ActivityTable>
      <TableBody>
         <TableSkeletonRows
            columns={SKELETON_COLUMNS}
            rowClassName="[&>td:first-child]:px-6"
         />
      </TableBody>
   </ActivityTable>
);

export { ActivityRows, ActivitySkeleton, ActivityTable };
