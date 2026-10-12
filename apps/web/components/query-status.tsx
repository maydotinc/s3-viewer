import CenteredSpinner from "@/components/centered-spinner";
import type { Tone } from "@/components/icon-tile";
import StatusMessage, { RetryButton } from "@/components/status-message";
import { CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type QueryStatusProps = {
   error: { message: string } | string | null | undefined;
   title: string;
   loading?: boolean;
   loadingLabel?: string;
   loadingClassName?: string;
   icon?: LucideIcon;
   tone?: Tone;
   onRetry?: () => void;
   retrying?: boolean;
   className?: string;
   children?: ReactNode;
};

const QueryStatus = ({
   error,
   title,
   loading = false,
   loadingLabel = "Loading…",
   loadingClassName = "flex-1",
   icon = CircleAlert,
   tone = "error",
   onRetry,
   retrying,
   className,
   children,
}: QueryStatusProps) => {
   if (error)
      return (
         <StatusMessage
            icon={icon}
            tone={tone}
            title={title}
            className={className}
            actions={
               onRetry && (
                  <RetryButton
                     size="sm"
                     onRetry={onRetry}
                     retrying={retrying}
                  />
               )
            }
         >
            {typeof error === "string" ? error : error.message}
         </StatusMessage>
      );
   if (loading)
      return (
         <CenteredSpinner label={loadingLabel} className={loadingClassName} />
      );
   return children;
};

export default QueryStatus;
