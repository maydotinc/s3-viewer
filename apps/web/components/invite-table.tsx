import FolderLimitNote from "@/components/folder-limit-note";
import {
   EMPTY_NOTICE,
   STACKED_LABEL,
   STACKED_TABLE,
} from "@/components/Layout/table-states";
import ListPagination, {
   loadNext,
   type LoadMoreQuery,
} from "@/components/list-pagination";
import { ConfirmButton } from "@/components/Modals/confirm-button";
import QueryStatus from "@/components/query-status";
import SettingsCard from "@/components/Settings/card";
import StatusMessage from "@/components/status-message";
import TableSkeletonRows from "@/components/table-skeleton";
import useRevokeInvite from "@/lib/hooks/mutations/invites/useRevokeInvite";
import { useNow } from "@/lib/hooks/useNow";
import { formatDay } from "@/lib/utils/format";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import type { BucketAccessEntry, Role } from "@s3-viewer/types";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { cn } from "@s3-viewer/ui/lib/utils";
import { MailX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Column = { label: string; align?: "left" | "right"; width?: string };

type InviteTableProps = {
   columns: readonly Column[];
   actionsWidth: string;
   loading?: boolean;
   children?: ReactNode;
};

const InviteTable = ({
   columns,
   actionsWidth,
   loading = false,
   children,
}: InviteTableProps) => (
   <Table
      aria-busy={loading || undefined}
      className={cn(
         STACKED_TABLE,
         "md:[&_tr>*:first-child]:pl-6 md:[&_tr>*:last-child]:pr-6"
      )}
   >
      <TableHeader>
         <TableRow>
            {columns.map(({ label, align, width }) => (
               <TableHead
                  key={label}
                  className={cn(width, align === "right" && "text-right")}
               >
                  {label}
               </TableHead>
            ))}
            <TableHead className={actionsWidth}>
               <span className="sr-only">Actions</span>
            </TableHead>
         </TableRow>
      </TableHeader>
      <TableBody>
         {loading ? (
            <TableSkeletonRows columns={[...columns, { align: "right" }]} />
         ) : (
            children
         )}
      </TableBody>
   </Table>
);

const TextCell = ({
   label,
   strong = false,
   children,
}: {
   label?: string;
   strong?: boolean;
   children: string;
}) => (
   <TableCell
      title={children}
      data-label={label}
      className={cn(
         "truncate",
         label && STACKED_LABEL,
         strong ? "font-medium" : "text-viewertext"
      )}
   >
      {children}
   </TableCell>
);

const RoleCell = ({
   role,
   bucketAccess,
}: {
   role: Role;
   bucketAccess: readonly BucketAccessEntry[];
}) => (
   <TableCell
      data-label="Role"
      className={cn("text-viewertext", STACKED_LABEL)}
   >
      {ROLE_LABELS[role]}
      <FolderLimitNote entries={bucketAccess} />
   </TableCell>
);

const ExpiresCell = ({ expiresAt }: { expiresAt: string }) => {
   const now = useNow() ?? Date.now();
   const expired = new Date(expiresAt).getTime() <= now;
   return (
      <TableCell
         data-label="Expires"
         className={cn(
            "text-right tabular-nums",
            STACKED_LABEL,
            expired ? "text-viewertextred" : "text-viewertext"
         )}
      >
         {expired ? "Expired" : formatDay(expiresAt)}
      </TableCell>
   );
};

const ActionsCell = ({ children }: { children: ReactNode }) => (
   <TableCell>
      <div className="flex justify-end gap-2">{children}</div>
   </TableCell>
);

type RevokeInviteButtonProps = {
   serverId: string;
   inviteId: string;
   email: string;
};

const RevokeInviteButton = ({
   serverId,
   inviteId,
   email,
}: RevokeInviteButtonProps) => {
   const revoke = useRevokeInvite();
   return (
      <ConfirmButton
         variant="ghost"
         size="sm"
         aria-label={`Revoke invite for ${email}`}
         confirmTitle="Revoke invite"
         confirmDescription={`The invite for ${email} stops working right away. To add them later, send a new invite.`}
         confirmLabel="Revoke"
         isPending={revoke.isPending}
         onConfirm={(close) =>
            revoke.mutate({ serverId, inviteId }, { onSuccess: close })
         }
      >
         Revoke
      </ConfirmButton>
   );
};

type InviteListCardProps<T extends { id: string }> = {
   title: string;
   description: string;
   action?: ReactNode;
   notice?: ReactNode;
   pending: boolean;
   query: LoadMoreQuery & { invites: T[]; isLoading: boolean };
   errorTitle: string;
   emptyIcon: LucideIcon;
   empty: string;
   columns: readonly Column[];
   actionsWidth: string;
   renderRow: (invite: T) => ReactNode;
};

const InviteListCard = <T extends { id: string }>({
   title,
   description,
   action,
   notice,
   pending,
   query,
   errorTitle,
   emptyIcon,
   empty,
   columns,
   actionsWidth,
   renderRow,
}: InviteListCardProps<T>) => {
   const { invites, error } = query;
   const loading = pending || query.isLoading;
   const failed = !loading && invites.length === 0 ? error : null;

   const body = loading ? (
      <InviteTable columns={columns} actionsWidth={actionsWidth} loading />
   ) : (
      <QueryStatus
         error={failed}
         icon={MailX}
         title={errorTitle}
         retrying={query.isFetching}
         onRetry={() => void loadNext(query)}
      >
         {invites.length === 0 ? (
            <StatusMessage icon={emptyIcon} className={EMPTY_NOTICE}>
               {empty}
            </StatusMessage>
         ) : (
            <InviteTable columns={columns} actionsWidth={actionsWidth}>
               {invites.map((invite) => (
                  <TableRow key={invite.id}>{renderRow(invite)}</TableRow>
               ))}
            </InviteTable>
         )}
      </QueryStatus>
   );

   return (
      <SettingsCard
         flush
         title={title}
         description={description}
         action={action}
      >
         <div className="flex min-h-72 flex-col md:h-72 md:overflow-auto md:[scrollbar-gutter:stable]">
            {notice}
            {body}
            {!loading && !failed && (query.hasNextPage || error) && (
               <div className="px-4 py-4 sm:px-6">
                  <ListPagination {...query} label="Load more invites" />
               </div>
            )}
         </div>
      </SettingsCard>
   );
};

export {
   ActionsCell,
   ExpiresCell,
   InviteListCard,
   InviteTable,
   RevokeInviteButton,
   RoleCell,
   TextCell,
};
export type { Column };
