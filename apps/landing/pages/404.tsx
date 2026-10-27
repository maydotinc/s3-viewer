import ErrorPage from "@s3-viewer/ui/error-page";
import { siteTitle } from "@/lib/site-title";
import Head from "next/head";

const NotFoundPage = () => (
   <>
      <Head>
         <title>{siteTitle("Page not found")}</title>
         <meta name="robots" content="noindex, follow" />
      </Head>
      <ErrorPage embedded code={404} href="/" linkLabel="Back to home" />
   </>
);

export default NotFoundPage;
