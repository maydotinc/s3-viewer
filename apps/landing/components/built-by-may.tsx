import { ExternalLink } from "@/components/external-link";
import { MAY_NAME, MAY_ROUNDED_LOGO_URL, MAY_URL } from "@/lib/site-config";
import { cn } from "@s3-viewer/ui/lib/utils";
import Image from "next/image";

const BuiltByMay = ({ className }: { className?: string }) => (
   <ExternalLink
      href={MAY_URL}
      className={cn(
         "inline-flex items-center gap-2 text-sm text-viewerlighttext transition-colors hover:text-viewerblack",
         className
      )}
   >
      <span>Built by</span>
      <Image
         src={MAY_ROUNDED_LOGO_URL}
         alt=""
         width={20}
         height={20}
         className="size-5 rounded-[5px]"
         draggable={false}
      />
      <span>{MAY_NAME}</span>
   </ExternalLink>
);

export { BuiltByMay };
