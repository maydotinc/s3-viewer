import type { Tone } from "@/components/icon-tile";
import StatusMessage, { RetryButton } from "@/components/status-message";
import { CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// a loading state always brings its own shape-matched skeleton, so a card inside a mounted shell never spins
type LoadingProps =
   | { loading?: undefined; skeleton?: undefined }
   | { loading: boolean; skeleton: ReactNode };

type QueryStatusProps = LoadingProps & {
   error: { message: string } | string | null | undefined;
   title: string;
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
   return loading ? skeleton : children;
};

export default QueryStatus;
