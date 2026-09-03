import ModalManager from "@/components/Modals/ModalManager";
import AuthGuard from "@/components/Session/auth-guard";
import SessionManager from "@/components/Session/session-manager";
import { ModalProvider } from "@/lib/contexts/ModalContext";
import { makeQueryClient } from "@/lib/queryClient";
import { PRODUCT_NAME } from "@s3-viewer/types";
import { SidebarProvider } from "@s3-viewer/ui/components/sidebar";
import Toaster from "@s3-viewer/ui/components/toast";
import "@s3-viewer/ui/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import Head from "next/head";
import { ReactElement, ReactNode, useState } from "react";

type NextPageWithLayout<P = Record<string, never>, IP = P> = NextPage<P, IP> & {
   getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & { Component: NextPageWithLayout };

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const App = ({ Component, pageProps }: AppPropsWithLayout) => {
   const [queryClient] = useState(makeQueryClient);
   const getLayout = Component.getLayout ?? ((page) => page);

   return (
      <QueryClientProvider client={queryClient}>
         <Head>
            <meta charSet="utf-8" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
            <meta name="theme-color" content="#3658c1" />
            <meta name="application-name" content={PRODUCT_NAME} />
            <meta name="apple-mobile-web-app-title" content={PRODUCT_NAME} />
            <link rel="icon" href="/favicon.ico" sizes="any" />
            <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
            <link
               rel="icon"
               href="/favicon-96x96.png"
               type="image/png"
               sizes="96x96"
            />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
            <link rel="manifest" href="/site.webmanifest" />
         </Head>
         <div className={`${inter.variable} font-sans`}>
            <ModalProvider>
               <SessionManager />
               <AuthGuard>
                  <SidebarProvider>
                     {getLayout(<Component {...pageProps} />)}
                     <ModalManager />
                     <Toaster />
                  </SidebarProvider>
               </AuthGuard>
            </ModalProvider>
         </div>
      </QueryClientProvider>
   );
};

export default App;
export type { NextPageWithLayout };
