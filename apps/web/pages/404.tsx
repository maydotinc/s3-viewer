import Seo from "@/components/Seo";
import ErrorPage from "@s3-viewer/ui/ErrorPage";

const NotFound = () => (
   <>
      <Seo
         title="Page not found"
         description="This page doesn't exist in S3 Viewer."
      />
      <ErrorPage
         title="Page not found"
         description="This page doesn't exist, or you no longer have access to it. Check the link, or head back to your buckets."
      />
   </>
);

export default NotFound;
