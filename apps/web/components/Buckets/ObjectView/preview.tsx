import { useBucketContext } from "@/components/Buckets/Context";
import useObjectCommands from "@/components/Buckets/useObjectCommands";
import { MAX_PREVIEW_BYTES, previewKind } from "@/lib/utils/fileUtils";
import { formatBytes } from "@/lib/utils/format";
import type { S3ObjectPreview } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Eye, FileWarning } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { PREVIEW_ASPECT, PREVIEW_BOX, PreviewLoading } from "./preview-frame";

type ObjectPreviewProps = {
   preview: S3ObjectPreview | undefined;
   isLoading: boolean;
   isError: boolean;
   objectKey: string;
   fileName: string;
};

const DownloadAction = ({ objectKey }: { objectKey: string }) => {
   const { bucketName } = useBucketContext();
   const { can, download } = useObjectCommands(bucketName);
   const [busy, setBusy] = useState(false);
   if (!can.download) return null;

   const run = async () => {
      setBusy(true);
      try {
         await download(objectKey);
      } finally {
         setBusy(false);
      }
   };

   return (
      <Button
         variant="outline"
         size="sm"
         loading={busy}
         onClick={() => void run()}
      >
         {busy ? "Preparing…" : "Download"}
      </Button>
   );
};

const Message = ({
   icon: Icon,
   text,
   objectKey,
}: {
   icon: typeof Eye;
   text: string;
   objectKey: string;
}) => (
   <div className="flex flex-col items-center gap-3 text-center text-viewertext">
      <Icon className="size-10 text-viewerlighttext" aria-hidden="true" />
      <p className="text-sm">{text}</p>
      <DownloadAction objectKey={objectKey} />
   </div>
);

const ObjectPreview = ({
   preview,
   isLoading,
   isError,
   objectKey,
   fileName,
}: ObjectPreviewProps) => {
   if (isLoading) return <PreviewLoading />;

   if (isError || !preview) {
      return (
         <div className={PREVIEW_BOX}>
            <Message
               icon={Eye}
               text="Couldn't load the preview. Download it to view."
               objectKey={objectKey}
            />
         </div>
      );
   }

   const kind = previewKind(preview.contentType);
   if (kind === "none") {
      return (
         <div className={PREVIEW_BOX}>
            <Message
               icon={Eye}
               text="No preview for this file type. Download it to view."
               objectKey={objectKey}
            />
         </div>
      );
   }

   if (preview.contentLength > MAX_PREVIEW_BYTES) {
      return (
         <div className={PREVIEW_BOX}>
            <Message
               icon={FileWarning}
               text={`Too large to preview (${formatBytes(preview.contentLength)}). Download it to view.`}
               objectKey={objectKey}
            />
         </div>
      );
   }

   return (
      <div className={`${PREVIEW_BOX} fade-in`}>
         {kind === "image" && (
            <div className={`${PREVIEW_ASPECT} relative`}>
               <Image
                  src={preview.url}
                  alt={fileName}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-contain"
                  draggable={false}
               />
            </div>
         )}
         {kind === "video" && (
            <video
               src={preview.url}
               controls
               className="max-h-full max-w-full rounded-lg"
            >
               Your browser can&apos;t play this video.
            </video>
         )}
         {kind === "audio" && (
            <div className="flex w-full max-w-md flex-col items-center gap-4">
               <p className="max-w-full truncate text-sm text-viewertext">
                  {fileName}
               </p>
               <audio
                  src={preview.url}
                  controls
                  preload="metadata"
                  className="w-full"
               >
                  Your browser can&apos;t play this audio.
               </audio>
            </div>
         )}
         {kind === "pdf" && (
            <iframe
               src={preview.url}
               title={`Preview of ${fileName}`}
               className="size-full rounded-lg border border-viewerborder bg-viewerwhite"
            />
         )}
         {kind === "text" && (
            <iframe
               src={preview.url}
               title={`Preview of ${fileName}`}
               sandbox=""
               className="size-full rounded-lg border border-viewerborder bg-viewerwhite"
            />
         )}
      </div>
   );
};

export default ObjectPreview;
