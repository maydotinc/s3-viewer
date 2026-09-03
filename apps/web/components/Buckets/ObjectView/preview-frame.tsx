import { Skeleton } from "@s3-viewer/ui/components/skeleton";

const PREVIEW_BOX =
   "flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-viewergray p-6";
const PREVIEW_ASPECT = "aspect-[4/3] w-full max-w-3xl max-h-full";

const PreviewSkeleton = () => (
   <div className={PREVIEW_BOX} aria-busy="true">
      <Skeleton className={PREVIEW_ASPECT} />
   </div>
);

export { PREVIEW_ASPECT, PREVIEW_BOX, PreviewSkeleton };
