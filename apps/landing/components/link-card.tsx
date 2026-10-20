import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { SiteLink } from "@/components/external-link";
import type { ReactNode } from "react";

type LinkCardProps = {
   href: string;
   title: ReactNode;
   description: ReactNode;
   heading?: "h2" | "h3";
   className?: string;
   titleClassName?: string;
   media?: ReactNode;
   footer?: ReactNode;
   showArrow?: boolean;
   "aria-label"?: string;
};

const LinkCard = ({
   href,
   title,
   description,
   heading: Heading = "h3",
   className,
   titleClassName,
   media,
   footer,
   showArrow = true,
   "aria-label": ariaLabel,
}: LinkCardProps) => {
   const arrow = showArrow && (
      <ArrowUpRight
         aria-hidden
         className="size-4 flex-none text-viewerlighttext transition-colors group-hover:text-viewerblack"
         strokeWidth={2}
      />
   );
   const heading = (
      <Heading
         className={cn(
            "text-base leading-snug font-semibold tracking-tight text-viewerblack",
            titleClassName
         )}
      >
         {title}
      </Heading>
   );
   const body = <p className="text-sm text-viewertext">{description}</p>;

   return (
      <SiteLink
         href={href}
         aria-label={ariaLabel}
         className={cn(
            "group flex flex-col gap-3 rounded-xl border border-viewerborder bg-viewerwhite p-5 outline-none transition-colors hover:border-viewerblue/40 focus-visible:border-viewerblue",
            FOCUS_RING,
            className
         )}
      >
         {media ? (
            <>
               <div className="flex items-center justify-between gap-3">
                  {media}
                  {arrow}
               </div>
               <div className="mt-auto flex flex-col gap-2">
                  {heading}
                  {body}
                  {footer}
               </div>
            </>
         ) : (
            <>
               <div className="flex items-start justify-between gap-3">
                  {heading}
                  {arrow}
               </div>
               {body}
               {footer}
            </>
         )}
      </SiteLink>
   );
};

export default LinkCard;
