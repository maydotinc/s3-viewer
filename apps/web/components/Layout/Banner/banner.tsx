import CommandMenuTrigger from "@/components/CommandMenu/trigger";
import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";
import { SidebarTrigger } from "@s3-viewer/ui/components/sidebar";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import Image from "next/image";
import Link from "next/link";
import ProfileDropdown from "./profile-dropdown";

const ViewerBanner = () => (
   <header className="flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-viewerborder bg-viewerwhite px-3 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
         <Link
            href={SITE_PATHS.dashboard}
            className="flex shrink-0 items-center"
            draggable={false}
         >
            <Image
               src="/icons/viewer.svg"
               alt={PRODUCT_NAME}
               width={150}
               height={32}
               priority
               draggable={false}
               className="h-auto w-28 select-none sm:h-8 sm:w-auto"
            />
         </Link>
         <SimpleTooltip label="Toggle sidebar" shortcut="mod b">
            <SidebarTrigger className="size-9" />
         </SimpleTooltip>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
         <CommandMenuTrigger />
         <ProfileDropdown />
      </div>
   </header>
);

export default ViewerBanner;
