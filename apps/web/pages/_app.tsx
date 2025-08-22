import ModalManager from "@/components/Modals/ModalManager";
import AuthGuard from "@/components/Session/Auth/auth-guard";
import SessionManager from "@/components/Session/session-manager";
import { ModalProvider } from "@/lib/contexts/ModalContext";
import { queryClient } from "@/lib/queryClient";
import { authClient } from "@s3-viewer/auth/client";
import { SidebarProvider } from "@s3-viewer/ui/components/sidebar";
import Toaster from "@s3-viewer/ui/components/toast";
import "@s3-viewer/ui/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { NextPage } from "next";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import { ReactElement, ReactNode } from "react";
import LoadingAnimation from "@s3-viewer/ui/components/LoadingAnimation";

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

   const { isPending } = authClient.useSession();

   if (isPending) {
      return <LoadingAnimation />;
   }

   return (
      <QueryClientProvider client={queryClient}>
         <ModalProvider>
            <AuthGuard>
               <SessionManager />
               <SidebarProvider>
                  <Toaster />
                  <ModalManager />
                  <div className={`${inter.className} w-full`}>{page}</div>
               </SidebarProvider>
            </AuthGuard>
         </ModalProvider>
      </QueryClientProvider>
   );
}
