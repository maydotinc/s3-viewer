import ErrorPage from "@s3-viewer/ui/error-page";
import Head from "next/head";

const NotFoundPage = () => (
   <>
      <Head>
         <title>Page not found | S3 Viewer</title>
         <meta name="robots" content="noindex, follow" />
      </Head>
      <ErrorPage embedded code={404} href="/" linkLabel="Back to home" />
   </>
);

export default NotFoundPage;
