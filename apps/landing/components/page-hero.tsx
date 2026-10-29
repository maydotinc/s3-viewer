import Breadcrumb, { type BreadcrumbProps } from "@/components/breadcrumb";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

// pulled up under the transparent header so the hero starts at the top of the page.
const PageHero = ({
   children,
   contentClassName,
   ...breadcrumb
}: BreadcrumbProps & { children: ReactNode; contentClassName?: string }) => (
   <section className="-mt-22 border-b border-viewerborder pt-22">
      <div
         className={cn(
            "mx-auto w-full max-w-6xl px-6 pt-4 pb-12 sm:pt-16 sm:pb-16",
            contentClassName
         )}
      >
         <Breadcrumb {...breadcrumb} />
         {children}
      </div>
   </section>
);

export default PageHero;
