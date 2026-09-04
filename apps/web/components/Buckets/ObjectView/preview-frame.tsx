import { Spinner } from "@s3-viewer/ui/components/spinner";

const PREVIEW_BOX =
   "flex min-h-64 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite p-6";
const PREVIEW_PANEL =
   "flex min-h-64 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite";
const PREVIEW_ASPECT = "aspect-[4/3] w-full max-w-3xl max-h-full";

const PreviewLoading = () => (
   <div className={PREVIEW_BOX}>
      <Spinner size="lg" label="Loading preview" />
   </div>
);

// loads the presigned url directly, so the bucket needs no cors
const TextFrame = ({ url, fileName }: { url: string; fileName: string }) => (
   <div className={PREVIEW_BOX}>
      <iframe
         src={url}
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
