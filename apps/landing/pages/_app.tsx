import "@s3-viewer/ui/globals.css";
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

export default function App({ Component, pageProps }: AppPropsWithLayout) {
   const getLayout = Component.getLayout ?? ((page) => page);
   const page: ReactNode = getLayout(<Component {...pageProps} />);

   return <main className={`${inter.className} bg-viewerwhite`}>{page}</main>;
}
