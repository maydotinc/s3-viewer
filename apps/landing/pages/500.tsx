import ErrorPage from "@s3-viewer/ui/error-page";
import { siteTitle } from "@/lib/site-title";
import Head from "next/head";

const ServerErrorPage = () => (
   <>
      <Head>
         <title>{siteTitle("Something went wrong")}</title>
         <meta name="robots" content="noindex, follow" />
      </Head>
      <ErrorPage embedded code={500} href="/" linkLabel="Back to home" />
   </>
);

export default ServerErrorPage;
