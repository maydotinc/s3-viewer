import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { CircleAlert, Inbox, ServerOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const IconTile = ({ icon: Icon }: { icon: LucideIcon }) => (
   <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-viewergray">
      <Icon className="size-5 text-viewerlighttext" aria-hidden="true" />
   </span>
);

const EmptyState = ({
   title,
   description,
   icon = Inbox,
}: {
   title: string;
   description: string;
   icon?: LucideIcon;
}) => (
   <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <IconTile icon={icon} />
      <div className="flex flex-col gap-1">
         <p className="text-sm font-medium text-viewerblack">{title}</p>
         <p className="text-sm text-viewertext">{description}</p>
      </div>
   </div>
);

/**
 * The one centred failure state for a grid area: icon tile, title, one line of
 * detail and the actions that fix it. Shared by the bucket list and the object
 * list so both read the same.
 */
const GridErrorState = ({
   icon = CircleAlert,
   title,
   detail,
   children,
}: {
   icon?: LucideIcon;
   title: string;
   detail: string;
   children?: ReactNode;
}) => (
   <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
         <IconTile icon={icon} />
         <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-viewerblack">{title}</p>
            <p className="text-sm text-viewertext">{detail}</p>
         </div>
         {children && (
            <div className="flex flex-wrap items-center justify-center gap-2">
               {children}
            </div>
         )}
      </div>
   </div>
);

type RetryProps = { onRetry: () => void; retrying?: boolean };

const RetryButton = ({ onRetry, retrying }: RetryProps) => (
   <Button variant="outline" loading={retrying} onClick={onRetry}>
      Try again
   </Button>
);

/**
 * Unreadable or rejected server credentials are the one failure a user can fix
 * in place, so this state offers the credentials dialog as its primary action
 * to owners and tells everyone else who to ask.
 */
const CredentialsErrorState = ({
   message,
   onRetry,
   retrying,
}: { message: string } & RetryProps) => {
   const { currentServer } = useServers();
   const { openUpdateCredentialsModal } = useModalContext();
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
                  openUpdateCredentialsModal({
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

/** Skeleton rows, not a spinner — the loaded shape of a grid body is known. */
const LoadingOverlay = () => (
   <div
      className="flex size-full flex-col gap-2 p-4"
      aria-busy="true"
      aria-label="Loading rows"
   >
      {Array.from({ length: 7 }, (_, index) => (
         <Skeleton key={index} className="h-11 w-full shrink-0 rounded-lg" />
      ))}
   </div>
);

export {
   CredentialsErrorState,
   EmptyState,
   GridErrorState,
   LoadingOverlay,
   RetryButton,
};
