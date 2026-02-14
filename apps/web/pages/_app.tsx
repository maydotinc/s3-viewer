import ModalManager from "@/components/Modals/ModalManager";
import AuthGuard from "@/components/Session/Auth/auth-guard";
import SessionManager from "@/components/Session/session-manager";
import { ModalProvider } from "@/lib/contexts/ModalContext";
import { queryClient } from "@/lib/queryClient";
import { SidebarProvider } from "@s3-viewer/ui/components/sidebar";
import Toaster from "@s3-viewer/ui/components/toast";
import "@s3-viewer/ui/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { NextPage } from "next";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import Head from "next/head";
import { ReactElement, ReactNode } from "react";

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
   getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
   Component: NextPageWithLayout;
};

const inter = Inter({ subsets: ["latin"] });

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
   const getLayout = Component.getLayout ?? ((page) => page);
   const page: ReactNode = getLayout(<Component {...pageProps} />);

   return (
      <QueryClientProvider client={queryClient}>
         <ModalProvider>
            <AuthGuard>
               <SessionManager />
               <SidebarProvider>
                  <Toaster />
                  <ModalManager />
                  <Head>
                     <meta charSet="utf-8" />
                     <meta name="viewport" content="width=device-width, initial-scale=1" />
                     <meta name="theme-color" content="#2563eb" />
                     <link rel="icon" href="/logo.svg" />
                     <link rel="apple-touch-icon" href="/logo.svg" />
                     <meta name="application-name" content="S3 Viewer" />
                     <meta name="apple-mobile-web-app-title" content="S3 Viewer" />
                     <meta name="apple-mobile-web-app-capable" content="yes" />
                  </Head>
                  <div className={`${inter.className} w-full`}>{page}</div>
               </SidebarProvider>
            </AuthGuard>
         </ModalProvider>
      </QueryClientProvider>
   );
}
