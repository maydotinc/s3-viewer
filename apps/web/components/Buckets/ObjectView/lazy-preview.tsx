import dynamic from "next/dynamic";
import { PreviewSkeleton } from "./preview-frame";

const LazyPreview = dynamic(() => import("./preview"), {
   ssr: false,
   loading: PreviewSkeleton,
});

export { LazyPreview };
