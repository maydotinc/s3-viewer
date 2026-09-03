import { formatDay } from "@/lib/utils/format";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import type { Role } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

type Column = { label: string; align?: "left" | "right" };

type InviteTableProps = {
   columns: readonly Column[];
   children: ReactNode;
};

const SKELETON_ROWS = 3;

/** Table shell shared by the received and sent invite cards. */
const InviteTable = ({ columns, children }: InviteTableProps) => (
   <Table className="border-t border-viewerborder">
      <TableHeader>
         <TableRow>
            {columns.map(({ label, align }) => (
               <TableHead
                  key={label}
                  className={cn(align === "right" && "text-right")}
               >
                  {label}
               </TableHead>
            ))}
            <TableHead className="w-10">
               <span className="sr-only">Actions</span>
            </TableHead>
         </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
   </Table>
);

/** Skeleton rows matching the row height — no spinner. */
const InviteTableSkeleton = ({ columns }: { columns: number }) => (
   <>
      {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
         <TableRow key={row} aria-busy="true" className="hover:bg-transparent">
            {Array.from({ length: columns }).map((_, cell) => (
               <TableCell key={cell}>
                  <Skeleton className="h-3.5 w-24" />
               </TableCell>
            ))}
            <TableCell>
               <Skeleton className="ml-auto size-8 rounded-lg" />
            </TableCell>
         </TableRow>
      ))}
   </>
);

const RoleCell = ({ role }: { role: Role }) => (
   <TableCell>
      <Badge variant="outline">{ROLE_LABELS[role]}</Badge>
   </TableCell>
);

const ExpiresCell = ({ expiresAt }: { expiresAt: string }) => {
   const expired = new Date(expiresAt).getTime() <= Date.now();
   return (
      <TableCell
         className={cn(
            "text-right tabular-nums",
            expired ? "text-viewertextred" : "text-viewertext"
         )}
      >
         {expired ? "Expired" : formatDay(expiresAt)}
      </TableCell>
   );
};

/** Inline error inside a flush card. */
const InviteTableError = ({ message }: { message: string }) => (
   <p role="alert" className="px-6 pb-6 text-sm text-viewertextred">
      {message}
   </p>
);

export {
   ExpiresCell,
   InviteTable,
   InviteTableError,
   InviteTableSkeleton,
   RoleCell,
};
export type { Column };
