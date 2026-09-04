import "@/styles/globals.css";
import ErrorBoundary from "@/components/error-boundary";
import { inter } from "@/lib/fonts";
import { FAVICON_LINKS } from "@s3-viewer/ui/components/favicon-links";
import { NextPage } from "next";
import type { AppProps } from "next/app";
import Head from "next/head";
import { ReactElement, ReactNode } from "react";

export type NextPageWithLayout<P = Record<string, never>, IP = P> = NextPage<
   P,
   IP
> & {
   getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
   Component: NextPageWithLayout;
};

export default function App({ Component, pageProps }: AppPropsWithLayout) {
   const getLayout = Component.getLayout ?? ((page) => page);
   const page: ReactNode = getLayout(<Component {...pageProps} />);

   return (
      <div className={`${inter.className} bg-viewerwhite`}>
         <Head>
            <meta charSet="utf-8" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
            <meta name="theme-color" content="#3658C1" />
            {FAVICON_LINKS}
            <meta name="application-name" content="S3 Viewer" />
            <meta name="apple-mobile-web-app-title" content="S3 Viewer" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
         </Head>
         <ErrorBoundary>{page}</ErrorBoundary>
      </div>
   );
}
