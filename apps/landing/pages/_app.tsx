import "@/styles/globals.css";
import { withLayout } from "@/components/Layout";
import { inter } from "@/lib/fonts";
import { PRODUCT_NAME } from "@s3-viewer/types/constants";
import { FAVICON_LINKS } from "@s3-viewer/ui/components/favicon-links";
import ErrorBoundary from "@s3-viewer/ui/error-boundary";
import ErrorPage from "@s3-viewer/ui/error-page";
import { PALETTE } from "@s3-viewer/ui/lib/palette";
import { NextPage } from "next";
import type { AppProps } from "next/app";
import Head from "next/head";
import { ReactElement, ReactNode } from "react";

type NextPageWithLayout<P = Record<string, never>, IP = P> = NextPage<P, IP> & {
   getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
   Component: NextPageWithLayout;
};

export default function App({
   Component,
   pageProps,
   router,
}: AppPropsWithLayout) {
   const getLayout = Component.getLayout ?? withLayout;
   const page: ReactNode = getLayout(<Component {...pageProps} />);

   return (
      <div className={`${inter.className} bg-viewerwhite`}>
         <Head>
            <meta charSet="utf-8" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
            <meta name="theme-color" content={PALETTE.viewerblue} />
            {FAVICON_LINKS}
            <meta name="application-name" content={PRODUCT_NAME} />
            <meta name="apple-mobile-web-app-title" content={PRODUCT_NAME} />
            <meta name="apple-mobile-web-app-capable" content="yes" />
         </Head>
         <ErrorBoundary
            resetKey={router.asPath}
            fallback={
               <ErrorPage code={500} href="/" linkLabel="Back to home" />
            }
         >
            {page}
         </ErrorBoundary>
      </div>
   );
}
