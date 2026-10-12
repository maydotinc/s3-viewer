import Breadcrumb, { type BreadcrumbProps } from "@/components/breadcrumb";
import type { ReactNode } from "react";

const PageHero = ({
   children,
   ...breadcrumb
}: BreadcrumbProps & { children: ReactNode }) => (
   <section className="border-b border-viewerborder bg-viewergray">
      <div className="mx-auto w-full max-w-6xl px-6 pt-10 pb-12 sm:pt-16 sm:pb-16">
         <Breadcrumb {...breadcrumb} />
         {children}
      </div>
   </section>
);

export default PageHero;
