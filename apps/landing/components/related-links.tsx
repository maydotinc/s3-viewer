import { Eyebrow } from "@/components/basic-block";
import LinkCard from "@/components/link-card";
import type { LinkRef } from "@/lib/link-ref";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type RelatedLinksProps = {
   eyebrow: string;
   heading: ReactNode;
   links: LinkRef[];
   all?: { href: string; label: string };
   compact?: boolean;
   cardTitleClassName?: string;
   className?: string;
};

const RelatedLinks = ({
   eyebrow,
   heading,
   links,
   all,
   compact = false,
   cardTitleClassName,
   className,
}: RelatedLinksProps) => (
   <div className={className}>
      <div
         className={cn(
            "flex items-end justify-between gap-6",
            compact ? "mb-6" : "mb-8"
         )}
      >
         <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
            <Eyebrow>{eyebrow}</Eyebrow>
            {heading}
         </div>
         {all && (
            <Link
               href={all.href}
               className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-viewerblue hover:underline"
            >
               {all.label}
               <ArrowUpRight className="size-3.5" />
            </Link>
         )}
      </div>
      <div
         className={cn(
            "grid grid-cols-1",
            compact ? "gap-3" : "md:grid-cols-3 gap-4"
         )}
      >
         {links.map((r) => (
            <LinkCard
               key={r.href}
               href={r.href}
               title={r.title}
               description={r.description}
               titleClassName={cardTitleClassName}
            />
         ))}
      </div>
   </div>
);

export default RelatedLinks;
