import { PRODUCT_NAME } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { CloudOff } from "lucide-react";

type SessionUnreachableProps = { onRetry: () => void };

// shown in place of the spinner when the session request failed or is taking
// too long: an honest state with a way out, rather than a spinner that never
// ends or a login page that could not work either
const SessionUnreachable = ({ onRetry }: SessionUnreachableProps) => (
   <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-viewerwhite px-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-viewergray">
         <CloudOff className="size-5 text-viewerlighttext" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-viewerblack">
         Can&apos;t reach {PRODUCT_NAME}
      </p>
      <p className="max-w-xs text-sm text-viewertext">
         Check your connection and try again. If the server just started, give
         it a moment.
      </p>
      <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
         Try again
      </Button>
   </div>
);

export default SessionUnreachable;
