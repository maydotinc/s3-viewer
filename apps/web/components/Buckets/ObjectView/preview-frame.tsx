import { Spinner } from "@s3-viewer/ui/components/spinner";

const PREVIEW_BOX =
   "flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-viewergray p-6";
const PREVIEW_ASPECT = "aspect-[4/3] w-full max-w-3xl max-h-full";

const PreviewLoading = () => (
   <div className={PREVIEW_BOX}>
      <Spinner size="lg" label="Loading preview" />
   </div>
);

export { PREVIEW_ASPECT, PREVIEW_BOX, PreviewLoading };
