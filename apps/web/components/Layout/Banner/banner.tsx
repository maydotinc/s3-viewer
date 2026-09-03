import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";
import { SidebarTrigger } from "@s3-viewer/ui/components/sidebar";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import Image from "next/image";
import Link from "next/link";
import ProfileDropdown from "./profile-dropdown";

// DESIGN.md §2: `h-14 px-6`, so the logo sits on the 24px inset — the sidebar
// toggle follows it rather than pushing it off that inset. The account slot
// renders a same-size placeholder while the session loads, so nothing below
// the banner moves.
const ViewerBanner = () => (
   <header className="flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b border-viewerborder bg-viewerwhite px-6">
      <div className="flex min-w-0 items-center gap-3">
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
               className="h-6 w-auto select-none"
            />
         </Link>
         <SimpleTooltip label="Toggle sidebar" shortcut="mod b">
            <SidebarTrigger className="size-8" />
         </SimpleTooltip>
      </div>
      <div className="flex shrink-0 items-center gap-2">
         <ProfileDropdown />
      </div>
   </header>
);

export default ViewerBanner;
