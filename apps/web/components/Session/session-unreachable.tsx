import StatusMessage, { RetryButton } from "@/components/status-message";
import { PRODUCT_NAME } from "@s3-viewer/shared";
import { CloudOff } from "lucide-react";

type SessionUnreachableProps = { onRetry: () => void };

const SessionUnreachable = ({ onRetry }: SessionUnreachableProps) => (
   <div className="flex h-dvh w-full bg-viewerwhite">
      <StatusMessage
         icon={CloudOff}
         title={`Can't reach ${PRODUCT_NAME}`}
         actions={<RetryButton size="sm" onRetry={onRetry} />}
      >
         Check your connection and try again. If the server just started, give
         it a moment.
      </StatusMessage>
   </div>
);

export default SessionUnreachable;
