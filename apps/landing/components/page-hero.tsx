import Breadcrumb, { type BreadcrumbProps } from "@/components/breadcrumb";
import type { ReactNode } from "react";

// pulled up under the transparent header so the grey band starts at the top of the page.
const PageHero = ({
   children,
   ...breadcrumb
}: BreadcrumbProps & { children: ReactNode }) => (
   <section className="-mt-22 border-b border-viewerborder bg-viewergray pt-22">
      <div className="mx-auto w-full max-w-6xl px-6 pt-10 pb-12 sm:pt-16 sm:pb-16">
         <Breadcrumb {...breadcrumb} />
         {children}
      </div>
   </section>
);

export default PageHero;
