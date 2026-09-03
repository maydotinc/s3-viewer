import { PRODUCT_NAME } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";

const FullPageSpinner = () => (
   <div className="flex h-dvh w-full items-center justify-center bg-viewerwhite">
      <Spinner size="lg" label={`Loading ${PRODUCT_NAME}`} />
   </div>
);

export default FullPageSpinner;
