import { SidebarProvider } from '@s3-viewer/ui/components/sidebar';
import '@s3-viewer/ui/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextPage } from 'next';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { ReactElement, ReactNode } from 'react';

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
}

const inter = Inter({ subsets: ['latin'] });
const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page) => page);
  const page : ReactNode = getLayout(<Component {...pageProps} />);

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <div className={`${inter.className} min-h-screen min-w-screen`}>
          {page}
        </div>
      </SidebarProvider>
    </QueryClientProvider>
  );
} 