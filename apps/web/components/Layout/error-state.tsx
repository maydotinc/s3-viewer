import { EMPTY_NOTICE } from "@/components/Layout/table-states";
import StatusMessage from "@/components/status-message";
import { SITE_PATHS } from "@s3-viewer/shared";
import { Button } from "@s3-viewer/ui/components/button";
import { ShieldOff } from "lucide-react";
import Link from "next/link";

const BackToDashboard = () => (
   <Button asChild variant="outline">
      <Link href={SITE_PATHS.dashboard}>Back to dashboard</Link>
   </Button>
);

const ErrorState = ({ message }: { message: string }) => (
   <div className="flex min-w-0 shrink-0 rounded-xl border border-viewerborder bg-viewerwhite">
      <StatusMessage
         icon={ShieldOff}
         className={EMPTY_NOTICE}
         actions={<BackToDashboard />}
      >
         {message}
      </StatusMessage>
   </div>
);

export default ErrorState;
export { BackToDashboard };
