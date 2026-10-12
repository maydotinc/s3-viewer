import ErrorPage from "@s3-viewer/ui/error-page";
import Head from "next/head";

const ServerErrorPage = () => (
   <>
      <Head>
         <title>Something went wrong | S3 Viewer</title>
         <meta name="robots" content="noindex, follow" />
      </Head>
      <ErrorPage embedded code={500} href="/" linkLabel="Back to home" />
   </>
);

export default ServerErrorPage;
