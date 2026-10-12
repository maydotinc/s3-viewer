import CenteredSpinner from "@/components/centered-spinner";
import { PRODUCT_NAME } from "@s3-viewer/types";

const FullPageSpinner = () => (
   <CenteredSpinner
      size="lg"
      label={`Loading ${PRODUCT_NAME}`}
      className="h-dvh w-full bg-viewerwhite"
   />
);

export default FullPageSpinner;
