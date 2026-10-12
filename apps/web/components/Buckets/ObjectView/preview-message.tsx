import useObjectCommands from "@/components/Buckets/useObjectCommands";
import type { Tone } from "@/components/icon-tile";
import StatusMessage, { RetryButton } from "@/components/status-message";
import useAsyncAction from "@/components/use-async-action";
import { canPresignObjectKey } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Download, type LucideIcon } from "lucide-react";
import { PREVIEW_BOX } from "./preview-frame";

const DownloadAction = ({ objectKey }: { objectKey: string }) => {
   const { can, download } = useObjectCommands();
   const { pending, run } = useAsyncAction();
   if (!can.download) return null;
   return (
      <Button
         variant="outline"
         loading={pending}
         onClick={() => void run(() => download(objectKey))}
      >
         <Download aria-hidden="true" />
         {canPresignObjectKey(objectKey) ? "Download" : "Download as zip"}
      </Button>
   );
};

type PreviewMessageProps = {
   icon: LucideIcon;
   title: string;
   text?: string;
   objectKey: string;
   tone?: Tone;
   onRetry?: () => Promise<unknown>;
};

const PreviewMessage = ({
   icon,
   title,
   text,
   objectKey,
   tone,
   onRetry,
}: PreviewMessageProps) => {
   const retry = useAsyncAction();
   return (
      <div className={PREVIEW_BOX}>
         <StatusMessage
            icon={icon}
            tone={tone}
            title={title}
            actions={
               <>
                  {onRetry && (
                     <RetryButton
                        retrying={retry.pending}
                        onRetry={() => void retry.run(onRetry)}
                     />
                  )}
                  <DownloadAction objectKey={objectKey} />
               </>
            }
         >
            {text}
         </StatusMessage>
      </div>
   );
};

export { PreviewMessage };
