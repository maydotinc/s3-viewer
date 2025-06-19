import AuthGuard from "@/components/Auth/authGuard";
import ModalManager from "@/components/Modals/ModalManager";
import { ModalProvider } from "@/lib/contexts/ModalContext";
import { SidebarProvider } from "@s3-viewer/ui/components/sidebar";
import Toaster from "@s3-viewer/ui/components/toast";
import "@s3-viewer/ui/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextPage } from "next";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import { ReactElement, ReactNode } from "react";

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
   getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
   Component: NextPageWithLayout;
};

const inter = Inter({ subsets: ["latin"] });
const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
   const getLayout = Component.getLayout ?? ((page) => page);
   const page: ReactNode = getLayout(<Component {...pageProps} />);

   return (
      <ModalProvider>
         <AuthGuard>
            <QueryClientProvider client={queryClient}>
               <SidebarProvider>
                  <Toaster />
                  <ModalManager />
                  <div className={`${inter.className} h-screen h-[100dvh] w-full`}>{page}</div>
               </SidebarProvider>
            </QueryClientProvider>
         </AuthGuard>
      </ModalProvider>
   );
}
