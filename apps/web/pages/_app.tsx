import CommandMenu from "@/components/CommandMenu";
import ModalManager from "@/components/Modals/ModalManager";
import AuthGuard from "@/components/Session/auth-guard";
import ErrorBoundary from "@/components/Session/error-boundary";
import SessionManager from "@/components/Session/session-manager";
import ShortcutsHelp from "@/components/Shortcuts/help-dialog";
import { ModalProvider } from "@/lib/contexts/ModalContext";
import { getQueryClient } from "@/lib/queryClient";
import { ShortcutsProvider } from "@/lib/shortcuts";
import { PRODUCT_NAME } from "@s3-viewer/types";
import { FAVICON_LINKS } from "@s3-viewer/ui/components/favicon-links";
import { SidebarProvider } from "@s3-viewer/ui/components/sidebar";
import Toaster from "@s3-viewer/ui/components/toast";
import { TooltipProvider } from "@s3-viewer/ui/components/tooltip";
import "@s3-viewer/ui/globals.css";
import { inter } from "@/lib/fonts";
import { QueryClientProvider } from "@tanstack/react-query";
import type { NextPage } from "next";
import type { AppProps } from "next/app";
import Head from "next/head";
import { ReactElement, ReactNode, useState } from "react";

type NextPageWithLayout<P = Record<string, never>, IP = P> = NextPage<P, IP> & {
   getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & { Component: NextPageWithLayout };

const App = ({ Component, pageProps }: AppPropsWithLayout) => {
   const [queryClient] = useState(getQueryClient);
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
            {FAVICON_LINKS}
            <style>{`:root{--font-inter:${inter.style.fontFamily}}`}</style>
         </Head>
         <ErrorBoundary>
            <ModalProvider>
               <SessionManager />
               <AuthGuard>
                  <TooltipProvider>
                     <ShortcutsProvider>
                        <SidebarProvider>
                           {getLayout(<Component {...pageProps} />)}
                           <CommandMenu />
                           <ModalManager />
                           <Toaster />
                           <ShortcutsHelp />
                        </SidebarProvider>
                     </ShortcutsProvider>
                  </TooltipProvider>
               </AuthGuard>
            </ModalProvider>
         </ErrorBoundary>
      </QueryClientProvider>
   );
};

export default App;
export type { NextPageWithLayout };
