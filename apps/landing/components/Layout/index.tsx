import { ReactElement, ReactNode } from "react";
import Footer from "./footer";
import Header from "./header";

const Layout = ({ children }: { children: ReactNode }) => {
   return (
      <div className="flex min-h-svh min-w-0 w-full flex-col [overflow-wrap:anywhere]">
         <a
            href="#content"
            className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[60] focus-visible:rounded-md focus-visible:bg-viewerblack focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-viewerwhite"
         >
            Skip to content
         </a>
         <Header />
         <div
            id="content"
            tabIndex={-1}
            className="min-w-0 flex-1 outline-none"
         >
            {children}
         </div>
         <Footer />
      </div>
   );
};

export const withLayout = (page: ReactElement) => <Layout>{page}</Layout>;

export default Layout;
