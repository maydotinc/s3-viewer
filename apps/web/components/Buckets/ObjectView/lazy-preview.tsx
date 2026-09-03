import dynamic from "next/dynamic";
import { PreviewLoading } from "./preview-frame";

const LazyPreview = dynamic(() => import("./preview"), {
   ssr: false,
   loading: PreviewLoading,
});

export { LazyPreview };
