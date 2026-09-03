import { Spinner } from "@s3-viewer/ui/components/spinner";

/** The preview lives in a card, like every other panel on the page. */
const PREVIEW_BOX =
   "flex min-h-64 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite p-6";
const PREVIEW_ASPECT = "aspect-[4/3] w-full max-w-3xl max-h-full";

const PreviewLoading = () => (
   <div className={PREVIEW_BOX}>
      <Spinner size="lg" label="Loading preview" />
   </div>
);

export { PREVIEW_ASPECT, PREVIEW_BOX, PreviewLoading };
