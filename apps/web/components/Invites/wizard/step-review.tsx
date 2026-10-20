import InlineAlert from "@/components/inline-alert";
import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import type { EmailState } from "@/lib/hooks/queries/useInstanceConfig";
import { folderList, grantLabel } from "@/lib/utils/folder-access";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { Role, type ServerInfo } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { cn } from "@s3-viewer/ui/lib/utils";
import { memo, useId } from "react";
import type { GrantRow } from "../bucket-grants";
import LinkButton from "../link-button";
import type { ServerAccess } from "./wizard-state";

type ReviewServer = { server: ServerInfo; access: ServerAccess };

type StepReviewProps = {
   emails: readonly string[];
   servers: readonly ReviewServer[];
   email: EmailState;
   notify: boolean;
   requestError: string | null;
   retrying: boolean;
   disabled?: boolean;
   onNotifyChange: (notify: boolean) => void;
   onEditPeople: () => void;
   onEditServer: (serverId: string) => void;
   onRetry: () => void;
};

const FIND_IT =
   "People find the invite under Settings, Invitations after signing in with that address.";

const NOTIFY_DETAIL: Readonly<Record<EmailState, string>> = {
   enabled: `Without an email, nobody is told. ${FIND_IT}`,
   loading: `Without an email, nobody is told. ${FIND_IT}`,
   disabled: `This instance has no email configured, so invites are saved without sending. ${FIND_IT}`,
};

const NotifyToggle = ({
   email,
   notify,
   disabled,
   onChange,
}: {
   email: EmailState;
   notify: boolean;
   disabled?: boolean;
   onChange: (notify: boolean) => void;
}) => {
   const id = useId();
   const available = email === "enabled";
   return (
      <label
         htmlFor={id}
         className={cn(
            "flex items-start gap-3 rounded-lg border border-viewerborder px-3 py-3",
            available && !disabled && "cursor-pointer"
         )}
      >
         <Checkbox
            id={id}
            className="mt-0.5"
            checked={available && notify}
            disabled={disabled || !available}
            onCheckedChange={(next) => onChange(next === true)}
         />
         <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm text-viewerblack">
               Email each person an invite
            </span>
            <span className="text-xs leading-5 text-viewertext">
               {NOTIFY_DETAIL[email]}
            </span>
         </span>
      </label>
   );
};

const rowLabel = (row: GrantRow, serverRole: Role): string =>
   serverRole === Role.ADMIN ? "Admin · whole bucket" : grantLabel(row);

const ServerSummary = memo(function ServerSummary({
   server,
   access,
   disabled,
   onEdit,
}: ReviewServer & { disabled?: boolean; onEdit: (serverId: string) => void }) {
   const rows = [...access.rows].sort((a, b) =>
      a.bucketName.localeCompare(b.bucketName)
   );
   return (
      <div className="rounded-lg border border-viewerborder">
         <div className="flex h-12 items-center gap-3 px-3">
            <ServerLogo provider={server.provider} />
            <span className="min-w-0 truncate text-sm font-medium text-viewerblack">
               {server.name}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-viewerlighttext">
               {ROLE_LABELS[access.role]}
            </span>
            <LinkButton
               aria-label={`Edit access on ${server.name}`}
               disabled={disabled}
               onClick={() => onEdit(server.id)}
            >
               Edit
            </LinkButton>
         </div>
         <ul className="divide-y divide-viewerborder border-t border-viewerborder px-3 py-2">
            {rows.map((row) => (
               <li
                  key={row.bucketName}
                  className="flex h-9 items-center gap-3 text-sm"
               >
                  <span className="min-w-0 flex-1 truncate text-viewerblack">
                     {row.bucketName}
                  </span>
                  <span
                     title={
                        row.folders && row.folders.length > 1
                           ? folderList(row.folders)
                           : undefined
                     }
                     className="shrink-0 text-xs tabular-nums text-viewertext"
                  >
                     {rowLabel(row, access.role)}
                  </span>
               </li>
            ))}
         </ul>
      </div>
   );
});

const StepReview = ({
   emails,
   servers,
   email,
   notify,
   requestError,
   retrying,
   disabled,
   onNotifyChange,
   onEditPeople,
   onEditServer,
   onRetry,
}: StepReviewProps) => (
   <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
         <div className="flex h-5 items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-viewerblack">People</h3>
            <LinkButton
               aria-label="Edit people"
               disabled={disabled}
               onClick={onEditPeople}
            >
               Edit
            </LinkButton>
         </div>
         <ul className="flex flex-wrap gap-1.5">
            {emails.map((address) => (
               <li key={address} className="contents">
                  <Badge className="max-w-full">
                     <span className="truncate">{address}</span>
                  </Badge>
               </li>
            ))}
         </ul>
      </div>
      {servers.map(({ server, access }) => (
         <ServerSummary
            key={server.id}
            server={server}
            access={access}
            disabled={disabled}
            onEdit={onEditServer}
         />
      ))}
      <NotifyToggle
         email={email}
         notify={notify}
         disabled={disabled}
         onChange={onNotifyChange}
      />
      <div className="flex min-h-12 flex-col justify-end">
         {requestError && (
            <InlineAlert
               action={
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     loading={retrying}
                     onClick={onRetry}
                  >
                     Try again
                  </Button>
               }
            >
               Couldn&apos;t send invites. {requestError}
            </InlineAlert>
         )}
      </div>
   </div>
);

export default StepReview;
