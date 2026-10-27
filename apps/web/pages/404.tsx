import Seo from "@/components/seo";
import { PRODUCT_NAME } from "@s3-viewer/shared";
import ErrorPage from "@s3-viewer/ui/error-page";

const NotFound = () => (
   <>
      <Seo
         title="Page not found"
         description={`This page doesn't exist in ${PRODUCT_NAME}.`}
      />
      <ErrorPage code={404} />
   </>
);

export default NotFound;
