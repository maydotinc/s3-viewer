import Seo from "@/components/Seo";
import ErrorPage from "@s3-viewer/ui/ErrorPage";

const NotFound = () => (
   <>
      <Seo
         title="Page not found"
         description="This page doesn't exist in S3 Viewer."
      />
      <ErrorPage code={404} />
   </>
);

export default NotFound;
