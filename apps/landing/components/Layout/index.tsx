import { ReactNode } from "react";
import Footer from "./footer";
import Header from "./header";

const Layout = ({ children }: { children: ReactNode }) => {
   return (
      <div className="flex min-h-svh w-full flex-col">
         <Header />
         <div className="flex-1">{children}</div>
         <Footer />
      </div>
   );
};

export default Layout;
