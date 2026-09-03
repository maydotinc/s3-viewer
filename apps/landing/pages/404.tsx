import Layout from "@/components/Layout";
import ErrorPage from "@s3-viewer/ui/ErrorPage";
import Head from "next/head";

const NotFoundPage = () => (
   <>
      <Head>
         <title>Page not found | S3 Viewer</title>
         <meta name="robots" content="noindex, follow" />
      </Head>
      <ErrorPage code={404} href="/" linkLabel="Back to home" />
   </>
);

NotFoundPage.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default NotFoundPage;
