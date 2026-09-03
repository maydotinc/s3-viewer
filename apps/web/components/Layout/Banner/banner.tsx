import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";
import { SidebarTrigger } from "@s3-viewer/ui/components/sidebar";
import Image from "next/image";
import Link from "next/link";
import ProfileDropdown from "./profile-dropdown";

type ViewerBannerProps = {
   showSidebarToggle: boolean;
};

// Fixed 56px tall: the account slot renders a same-size placeholder while the
// session loads, so nothing below the banner moves.
const ViewerBanner = ({ showSidebarToggle }: ViewerBannerProps) => (
   <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-viewerborder bg-viewerwhite px-4">
      <div className="flex min-w-0 items-center gap-2">
         {showSidebarToggle && <SidebarTrigger className="md:hidden" />}
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
               className="h-7 w-[131px] select-none"
            />
         </Link>
      </div>
      <ProfileDropdown />
   </header>
);

export default ViewerBanner;
