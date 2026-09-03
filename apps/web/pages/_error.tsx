import Seo from "@/components/Seo";
import ErrorPage from "@s3-viewer/ui/ErrorPage";
import type { NextPageContext } from "next";

type ErrorProps = { statusCode: number };

const COPY = {
   404: {
      title: "Page not found",
      description: "This page doesn't exist in S3 Viewer.",
   },
   500: {
      title: "Something went wrong",
      description: "S3 Viewer hit an unexpected error.",
   },
} as const;

const ErrorRoute = ({ statusCode }: ErrorProps) => {
   const code = statusCode === 404 ? 404 : 500;
   return (
      <>
         <Seo title={COPY[code].title} description={COPY[code].description} />
         <ErrorPage code={code} />
      </>
   );
};

ErrorRoute.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => ({
   statusCode: res?.statusCode ?? err?.statusCode ?? 500,
});

export default ErrorRoute;
