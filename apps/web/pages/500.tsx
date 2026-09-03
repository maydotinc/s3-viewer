import Seo from "@/components/Seo";
import ErrorPage from "@s3-viewer/ui/ErrorPage";

const ServerError = () => (
   <>
      <Seo
         title="Something went wrong"
         description="S3 Viewer hit an unexpected error."
      />
      <ErrorPage
         title="Something went wrong"
         description="That's on us, not you. Try again in a moment — if it keeps happening, your buckets and files are untouched."
      />
   </>
);

export default ServerError;
