import {
   MAX_PREVIEW_BYTES,
   isStreamedKind,
   previewKind,
} from "@/lib/utils/file-utils";
import { formatBytes } from "@/lib/utils/format";
import { canPresignObjectKey, type S3ObjectPreview } from "@s3-viewer/types";
import {
   CircleAlert,
   EyeOff,
   FileWarning,
   FileX,
   RefreshCw,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import { createElement, useState } from "react";
import { previewBodyVersion } from "@/lib/utils/s3/preview-body";
import ArchivePreview from "./archive-preview";
import { usePreviewSource, type RefreshPreview } from "./preview-source";
import { PreviewMessage } from "./preview-message";
import JsonPreview from "./json-preview";
import MarkdownPreview from "./markdown-preview";
import {
   MediaFrame,
   paintClass,
   PREVIEW_ASPECT,
   PREVIEW_BOX,
   PreviewLoading,
   TextFrame,
} from "./preview-frame";

type ObjectPreviewProps = {
   preview: S3ObjectPreview | undefined;
   isLoading: boolean;
   isError: boolean;
   objectKey: string;
   fileName: string;
   refreshPreview?: RefreshPreview;
};

const PreviewLoadError = ({
   objectKey,
   onRetry,
}: {
   objectKey: string;
   onRetry?: () => Promise<unknown>;
}) => (
   <PreviewMessage
      icon={CircleAlert}
      tone="error"
      title="Couldn't load the preview"
      text="Try again, or download the file to view it."
      objectKey={objectKey}
      onRetry={onRetry}
   />
);

const ObjectPreview = ({
   preview,
   isLoading,
   isError,
   objectKey,
   fileName,
   refreshPreview,
}: ObjectPreviewProps) => {
   if (!canPresignObjectKey(objectKey)) {
      return (
         <PreviewMessage
            icon={EyeOff}
            title="No browser preview for this file"
            text="Its key can't be shared as a browser link. Download it as a zip to view."
            objectKey={objectKey}
         />
      );
   }
   if (isLoading) return <PreviewLoading />;

   if (isError || !preview) {
      return (
         <PreviewLoadError objectKey={objectKey} onRetry={refreshPreview} />
      );
   }

   if (preview.contentLength === 0) {
      return (
         <PreviewMessage
            icon={FileX}
            title="This file is empty"
            objectKey={objectKey}
         />
      );
   }

   const kind = previewKind(preview.contentType, fileName);
   if (kind === "archive")
      return <ArchivePreview preview={preview} fileName={fileName} />;
   if (kind === "none") {
      return (
         <PreviewMessage
            icon={EyeOff}
            title="No preview for this file type"
            text="Download it to view."
            objectKey={objectKey}
         />
      );
   }

   if (preview.contentLength > MAX_PREVIEW_BYTES && !isStreamedKind(kind)) {
      return (
         <PreviewMessage
            icon={FileWarning}
            title="Too large to preview"
            text={`This file is ${formatBytes(preview.contentLength)}. Download it to view.`}
            objectKey={objectKey}
         />
      );
   }

   return (
      <ActivePreview
         key={JSON.stringify([
            objectKey,
            previewBodyVersion(preview),
            preview.contentType,
            preview.contentLength,
            preview.lastModified,
         ])}
         preview={preview}
         objectKey={objectKey}
         fileName={fileName}
         refreshPreview={refreshPreview}
      />
   );
};

const ActivePreview = ({
   preview,
   objectKey,
   fileName,
   refreshPreview,
}: Pick<ObjectPreviewProps, "objectKey" | "fileName" | "refreshPreview"> & {
   preview: S3ObjectPreview;
}) => {
   const {
      source,
      generation,
      failed,
      recovering,
      media,
      recover,
      restorePlayback,
      playbackProgress,
      loaded,
   } = usePreviewSource(preview, refreshPreview);
   const kind = previewKind(preview.contentType, fileName);
   const [painted, setPainted] = useState(false);
   const onError = () => void recover();
   const onPainted = () => {
      setPainted(true);
      loaded();
   };
   const onMetadata = () => {
      setPainted(true);
      restorePlayback();
   };
   const content = failed ? (
      <PreviewLoadError objectKey={objectKey} onRetry={() => recover(true)} />
   ) : kind === "text" ? (
      <TextFrame
         key={generation}
         url={source.url}
         fileName={fileName}
         onError={onError}
         onLoad={loaded}
      />
   ) : kind === "json" || kind === "markdown" ? (
      createElement(kind === "json" ? JsonPreview : MarkdownPreview, {
         preview,
         fallbackUrl: source.url,
         fallbackGeneration: generation,
         objectKey,
         fileName,
      })
   ) : (
      <div className={PREVIEW_BOX}>
         {kind === "image" && (
            <MediaFrame painted={painted} className={PREVIEW_ASPECT}>
               <Image
                  key={generation}
                  src={source.url}
                  alt={fileName}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className={cn("object-contain", paintClass(painted))}
                  draggable={false}
                  onError={onError}
                  onLoad={onPainted}
               />
            </MediaFrame>
         )}
         {kind === "video" && (
            <MediaFrame painted={painted} className={PREVIEW_ASPECT}>
               <video
                  key={generation}
                  ref={media as React.Ref<HTMLVideoElement>}
                  src={source.url}
                  onError={onError}
                  onLoadedMetadata={onMetadata}
                  onTimeUpdate={playbackProgress}
                  controls
                  className={cn(
                     "absolute inset-0 size-full rounded-lg object-contain",
                     paintClass(painted)
                  )}
               >
                  Your browser can&apos;t play this video.
               </video>
            </MediaFrame>
         )}
         {kind === "audio" && (
            <div className="flex w-full max-w-md flex-col items-center gap-4">
               <p className="max-w-full truncate text-sm text-viewertext">
                  {fileName}
               </p>
               <audio
                  key={generation}
                  ref={media as React.Ref<HTMLAudioElement>}
                  src={source.url}
                  onError={onError}
                  onLoadedMetadata={restorePlayback}
                  onTimeUpdate={playbackProgress}
                  controls
                  preload="metadata"
                  className="w-full"
               >
                  Your browser can&apos;t play this audio.
               </audio>
            </div>
         )}
         {kind === "pdf" && (
            <MediaFrame painted={painted} className="size-full">
               {/* Chrome won't render a PDF in any sandboxed frame; preview URLs are served as application/pdf, never markup. */}
               <iframe
                  key={generation}
                  src={source.url}
                  title={`Preview of ${fileName}`}
                  referrerPolicy="no-referrer"
                  onError={onError}
                  onLoad={onPainted}
                  className={cn(
                     "size-full rounded-lg border border-viewerborder bg-viewerwhite",
                     paintClass(painted)
                  )}
               />
            </MediaFrame>
         )}
      </div>
   );

   return (
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
         {content}
         <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute -bottom-10 right-0"
            loading={recovering}
            onClick={() => void recover(true)}
         >
            <RefreshCw aria-hidden="true" />
            Reload preview
         </Button>
      </div>
   );
};

export default ObjectPreview;
