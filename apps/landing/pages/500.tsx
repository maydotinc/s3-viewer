import Layout from "@/components/Layout";
import ErrorPage from "@s3-viewer/ui/ErrorPage";
import Head from "next/head";

const ServerErrorPage = () => (
   <>
      <Head>
         <title>Something went wrong | S3 Viewer</title>
         <meta name="robots" content="noindex, follow" />
      </Head>
      <ErrorPage code={500} href="/" linkLabel="Back to home" />
   </>
);

ServerErrorPage.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default ServerErrorPage;
