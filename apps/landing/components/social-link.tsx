import { ExternalLink } from "@/components/external-link";
import { cn } from "@s3-viewer/ui/lib/utils";

// square icon button for a person's profile link; renders nothing without an href
export const SocialLink = ({
   href,
   icon: Icon,
   label,
   className,
   iconClassName,
}: {
   href?: string;
   icon: React.ComponentType<{ className?: string }>;
   label: string;
   className?: string;
   iconClassName?: string;
}) => {
   if (!href) return null;
   return (
      <ExternalLink
         href={href}
         aria-label={label}
         className={cn(
            "grid shrink-0 place-items-center size-9 sm:size-8 rounded-md border border-viewerborder bg-viewerwhite text-viewertext transition-colors hover:bg-viewerblack hover:text-viewerwhite hover:border-viewerblack",
            className
         )}
      >
         <Icon className={cn("size-4 sm:size-3.5", iconClassName)} />
      </ExternalLink>
   );
};
