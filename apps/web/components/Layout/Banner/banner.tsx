import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";
import { SidebarTrigger } from "@s3-viewer/ui/components/sidebar";
import Image from "next/image";
import Link from "next/link";
import ProfileDropdown from "./profile-dropdown";

type ViewerBannerProps = {
   children: React.ReactNode;
   showSidebarToggle: boolean;
};

const ViewerBanner = ({ children, showSidebarToggle }: ViewerBannerProps) => (
   <div className="flex size-full flex-col">
      <header className="sticky top-0 z-50 flex h-[var(--header-height)] w-full items-center justify-between gap-4 border-b border-viewerborder bg-viewergray px-4 sm:px-6 lg:px-10">
         <div className="flex min-w-0 items-center gap-2">
            {showSidebarToggle && <SidebarTrigger className="md:hidden" />}
            <Link
               href={SITE_PATHS.dashboard}
               className="flex items-center"
               draggable={false}
            >
               <Image
                  src="/icons/viewer.svg"
                  alt={PRODUCT_NAME}
                  width={150}
                  height={32}
                  priority
                  draggable={false}
                  className="h-6 w-[112px] select-none sm:h-8 sm:w-[150px]"
               />
            </Link>
         </div>
         <ProfileDropdown />
      </header>
      <div className="h-[calc(100svh-var(--header-height))] w-full">
         {children}
      </div>
   </div>
);

export default ViewerBanner;
