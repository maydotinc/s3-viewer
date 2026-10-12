import type { Tone } from "@/components/icon-tile";
import StatusMessage, {
   RetryButton,
   type RetryProps,
} from "@/components/status-message";
import { ApiError, errorMessage } from "@/lib/api";
import { useModalActions } from "@/lib/contexts/modal-context";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { isCredentialsErrorCode } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import type { ColDef } from "ag-grid-community";
import { CircleAlert, Inbox, ServerOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SkeletonRows } from "./skeleton";

const EmptyState = ({
   title,
   description,
   icon = Inbox,
}: {
   title: string;
   description: string;
   icon?: LucideIcon;
}) => (
   <StatusMessage icon={icon} title={title} className="px-4 py-6">
      {description}
   </StatusMessage>
);

const GridErrorState = ({
   icon = CircleAlert,
   tone = "error",
   title,
   detail,
   children,
}: {
   icon?: LucideIcon;
   tone?: Tone;
   title: string;
   detail: string;
   children?: ReactNode;
}) => (
   <StatusMessage
      icon={icon}
      tone={tone}
      size="lg"
      title={title}
      actions={children}
      className="px-4 py-6"
   >
      {detail}
   </StatusMessage>
);

const CredentialsErrorState = ({
   message,
   onRetry,
   retrying,
}: { message: string } & RetryProps) => {
   const { currentServer } = useCurrentServer();
   const { open } = useModalActions();
   const canUpdate =
      usePermission(Permission.UPDATE_CREDENTIALS) && Boolean(currentServer);

   return (
      <GridErrorState
         icon={ServerOff}
         title="Can't reach this server"
         detail={
            canUpdate
               ? message
               : "Ask the server owner to update the credentials."
         }
      >
         {canUpdate && currentServer && (
            <Button
               onClick={() =>
                  open("updateCredentials", {
                     server: currentServer,
                     onUpdated: onRetry,
                  })
               }
            >
               Update credentials
            </Button>
         )}
         <RetryButton onRetry={onRetry} retrying={retrying} />
      </GridErrorState>
   );
};

const GridLoadError = ({
   error,
   title,
   onRetry,
   retrying,
}: { error: unknown; title: string } & Partial<RetryProps>) =>
   onRetry &&
   error instanceof ApiError &&
   isCredentialsErrorCode(error.code) ? (
      <CredentialsErrorState
         message={error.message}
         onRetry={onRetry}
         retrying={retrying}
      />
   ) : (
      <GridErrorState title={title} detail={errorMessage(error)}>
         {onRetry && <RetryButton onRetry={onRetry} retrying={retrying} />}
      </GridErrorState>
   );

const LoadingOverlay = ({ columns }: { columns?: readonly ColDef[] }) => (
   <SkeletonRows columns={columns} />
);

export { EmptyState, GridErrorState, GridLoadError, LoadingOverlay };
