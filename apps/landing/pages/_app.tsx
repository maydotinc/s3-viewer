import "@/styles/globals.css";
import Layout from "@/components/Layout";
import { inter } from "@s3-viewer/ui/lib/fonts";
import { PRODUCT_NAME } from "@s3-viewer/shared/constants";
import { FAVICON_LINKS } from "@s3-viewer/ui/components/favicon-links";
import ErrorBoundary from "@s3-viewer/ui/error-boundary";
import ErrorPage from "@s3-viewer/ui/error-page";
import { PALETTE } from "@s3-viewer/ui/lib/palette";
import type { AppProps } from "next/app";
import Head from "next/head";

export default function App({ Component, pageProps, router }: AppProps) {
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
            <Layout>
               <Component {...pageProps} />
            </Layout>
         </ErrorBoundary>
      </div>
   );
}
