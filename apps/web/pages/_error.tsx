import Seo from "@/components/seo";
import { PRODUCT_NAME } from "@s3-viewer/shared";
import ErrorPage from "@s3-viewer/ui/error-page";

// Next.js renders pages/404.tsx for missing routes, so this page only ever shows a 500.
const ErrorRoute = () => (
   <>
      <Seo
         title="Something went wrong"
         description={`${PRODUCT_NAME} hit an unexpected error.`}
      />
      <ErrorPage code={500} />
   </>
);

export default ErrorRoute;
