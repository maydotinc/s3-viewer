import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useState, type ReactNode } from "react";

const PREVIEW_BOX =
   "flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite p-4 sm:p-6";
const PREVIEW_PANEL =
   "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite";
const PREVIEW_ASPECT = "aspect-[4/3] w-full max-w-3xl max-h-full";

// the same pulse stands in for the code-split chunk, the metadata request and the media itself, so loading reads as one state
const PreviewLoading = () => (
   <div className={PREVIEW_BOX} aria-busy="true">
      <Skeleton className={cn(PREVIEW_ASPECT, "rounded-lg")} />
      <span className="sr-only">Loading preview</span>
   </div>
);

// keeps the skeleton's footprint under media until it paints, then cross-fades
const MediaFrame = ({
   painted,
   className,
   children,
}: {
   painted: boolean;
   className: string;
   children: ReactNode;
}) => (
   <div className={cn("relative", className)}>
      {!painted && <Skeleton className="absolute inset-0 rounded-lg" />}
      {children}
   </div>
);

const paintClass = (painted: boolean) =>
   cn("transition-opacity duration-150", painted ? "opacity-100" : "opacity-0");

const TextFrame = ({
   url,
   fileName,
   onError,
   onLoad,
}: {
   url: string;
   fileName: string;
   onError?: () => void;
   onLoad?: () => void;
}) => {
   const [painted, setPainted] = useState(false);
   return (
      <div className={PREVIEW_BOX}>
         <MediaFrame painted={painted} className="size-full">
            <iframe
               src={url}
               onError={onError}
               onLoad={() => {
                  setPainted(true);
                  onLoad?.();
               }}
               title={`Preview of ${fileName}`}
               sandbox=""
               className={cn(
                  "size-full rounded-lg border border-viewerborder bg-viewerwhite",
                  paintClass(painted)
               )}
            />
         </MediaFrame>
      </div>
   );
};

export {
   MediaFrame,
   paintClass,
   PREVIEW_ASPECT,
   PREVIEW_BOX,
   PREVIEW_PANEL,
   PreviewLoading,
   TextFrame,
};
