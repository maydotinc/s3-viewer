import CenteredSpinner from "@/components/centered-spinner";

const PREVIEW_BOX =
   "flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite p-4 sm:p-6";
const PREVIEW_PANEL =
   "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite";
const PREVIEW_ASPECT = "aspect-[4/3] w-full max-w-3xl max-h-full";

const PreviewLoading = () => (
   <CenteredSpinner size="lg" label="Loading preview" className={PREVIEW_BOX} />
);

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
}) => (
   <div className={PREVIEW_BOX}>
      <iframe
         src={url}
         onError={onError}
         onLoad={onLoad}
         title={`Preview of ${fileName}`}
         sandbox=""
         className="size-full rounded-lg border border-viewerborder bg-viewerwhite"
      />
   </div>
);

export {
   PREVIEW_ASPECT,
   PREVIEW_BOX,
   PREVIEW_PANEL,
   PreviewLoading,
   TextFrame,
};
