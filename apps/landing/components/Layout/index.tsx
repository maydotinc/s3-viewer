import { ReactNode } from "react";
import Footer from "./footer";
import Header from "./header";

const Layout = ({ children }: { children: ReactNode }) => {
   return (
      <div className="flex flex-col size-full">
         <Header />
         {children}
         <Footer />
      </div>
   );
};

export default Layout;
