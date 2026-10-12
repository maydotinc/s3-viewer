import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type BreadcrumbProps = {
   trail?: { label: string; href: string }[];
   current: string;
   currentClassName?: string;
};

const LINK =
   "-my-1.5 inline-block py-1.5 transition-colors hover:text-viewerblack";

const Separator = () => (
   <ChevronRight className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
);

const Breadcrumb = ({
   trail = [],
   current,
   currentClassName,
}: BreadcrumbProps) => (
   <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-viewerlighttext">
         <li>
            <Link href="/" className={LINK}>
               Home
            </Link>
         </li>
         {trail.map((crumb) => (
            <li key={crumb.href} className="flex items-center gap-x-1.5">
               <Separator />
               <Link href={crumb.href} className={LINK}>
                  {crumb.label}
               </Link>
            </li>
         ))}
         <li className="flex min-w-0 items-center gap-x-1.5">
            <Separator />
            <span
               aria-current="page"
               className={cn("font-medium text-viewerblack", currentClassName)}
            >
               {current}
            </span>
         </li>
      </ol>
   </nav>
);

export default Breadcrumb;
