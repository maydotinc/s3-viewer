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
   // shape-matched placeholder shown instead of the spinner while loading
   skeleton?: ReactNode;
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
   skeleton,
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
         skeleton ?? <CenteredSpinner label={loadingLabel} className="flex-1" />
      );
   return children;
};

export default QueryStatus;
