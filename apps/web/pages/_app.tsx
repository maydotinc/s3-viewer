import Router from "next/router";
import { installNavigationGuard } from "@/lib/navigation-guard";
import CommandMenu from "@/components/CommandMenu";
import ModalManager from "@/components/Modals/modal-manager";
import AuthGuard from "@/components/Session/auth-guard";
import ErrorBoundary from "@s3-viewer/ui/error-boundary";
import SessionManager from "@/components/Session/session-manager";
import HelpDialog from "@/components/Shortcuts/help-dialog";
import { ModalProvider } from "@/lib/contexts/modal-context";
import { serverRuntimeEnv, setRuntimeEnv, type RuntimeEnv } from "@/lib/env";
import { getQueryClient } from "@/lib/query-client";
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
import NextApp, {
   type AppContext,
   type AppInitialProps,
   type AppProps,
} from "next/app";
import Head from "next/head";
import { ReactElement, ReactNode, useEffect, useState } from "react";

type NextPageWithLayout<P = Record<string, never>, IP = P> = NextPage<P, IP> & {
   getLayout?: (page: ReactElement) => ReactNode;
};

type AppOwnProps = { runtimeEnv?: RuntimeEnv };

type AppPropsWithLayout = AppProps &
   AppOwnProps & { Component: NextPageWithLayout };

const App = ({
   Component,
   pageProps,
   router,
   runtimeEnv,
}: AppPropsWithLayout) => {
   setRuntimeEnv(runtimeEnv);
   useEffect(() => {
      if (Router.router) return installNavigationGuard(Router.router);
   }, []);
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
         <ErrorBoundary resetKey={router.asPath}>
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
                           <HelpDialog />
                        </SidebarProvider>
                     </ShortcutsProvider>
                  </TooltipProvider>
               </AuthGuard>
            </ModalProvider>
         </ErrorBoundary>
      </QueryClientProvider>
   );
};

// server-only: client transitions see an empty `process.env`; this also opts out of static optimisation.
App.getInitialProps = async (
   context: AppContext
): Promise<AppInitialProps & AppOwnProps> => ({
   ...(await NextApp.getInitialProps(context)),
   ...(context.ctx.req ? { runtimeEnv: serverRuntimeEnv() } : {}),
});

export default App;
export type { NextPageWithLayout };
