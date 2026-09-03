import Layout from "@/components/Layout";
import ErrorPage from "@s3-viewer/ui/ErrorPage";
import type { NextPageContext } from "next";
import Head from "next/head";

type ErrorProps = { statusCode: 404 | 500 };

const CustomError = ({ statusCode }: ErrorProps) => (
   <>
      <Head>
         <title>
            {statusCode === 404
               ? "Page not found | S3 Viewer"
               : "Something went wrong | S3 Viewer"}
         </title>
         <meta name="robots" content="noindex, follow" />
      </Head>
      <ErrorPage code={statusCode} href="/" linkLabel="Back to home" />
   </>
);

CustomError.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
   const status = res?.statusCode ?? err?.statusCode ?? 500;
   return { statusCode: status === 404 ? 404 : 500 };
};

CustomError.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default CustomError;
