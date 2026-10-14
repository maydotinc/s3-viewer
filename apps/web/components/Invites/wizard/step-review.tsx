import InlineAlert from "@/components/inline-alert";
import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import NoEmailNotice from "@/components/no-email-notice";
import Reserve from "@/components/reserve";
import { folderList, grantLabel } from "@/lib/utils/folder-access";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { Role, type ServerInfo } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import { memo } from "react";
import type { GrantRow } from "../bucket-grants";
import type { ServerAccess } from "./wizard-state";

type EmailState = "loading" | "disabled" | "enabled";

type ReviewServer = { server: ServerInfo; access: ServerAccess };

type StepReviewProps = {
   emails: readonly string[];
   servers: readonly ReviewServer[];
   email: EmailState;
   requestError: string | null;
   retrying: boolean;
   disabled?: boolean;
   onEditPeople: () => void;
   onEditServer: (serverId: string) => void;
   onRetry: () => void;
};

const NO_EMAIL_DETAIL =
   "Invites are still saved. People see them under Settings, Invites after signing in with the same address.";

const EditLink = ({
   label,
   disabled,
   onClick,
}: {
   label: string;
   disabled?: boolean;
   onClick: () => void;
}) => (
   <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto shrink-0 px-0"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
   >
      Edit
   </Button>
);

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
            <EditLink
               label={`Edit access on ${server.name}`}
               disabled={disabled}
               onClick={() => onEdit(server.id)}
            />
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
   requestError,
   retrying,
   disabled,
   onEditPeople,
   onEditServer,
   onRetry,
}: StepReviewProps) => (
   <div className="flex min-w-0 flex-col gap-4">
      {email === "disabled" ? (
         <NoEmailNotice>{NO_EMAIL_DETAIL}</NoEmailNotice>
      ) : email === "loading" ? (
         <Reserve show={false} as="div">
            <NoEmailNotice>{NO_EMAIL_DETAIL}</NoEmailNotice>
         </Reserve>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2">
         <div className="flex h-5 items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-viewerblack">People</h3>
            <EditLink
               label="Edit people"
               disabled={disabled}
               onClick={onEditPeople}
            />
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
export type { EmailState, ReviewServer };
