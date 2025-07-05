import { authClient } from "@s3-viewer/auth/client";
import Image from "next/image";
import Link from "next/link";
import ProfileDropdown from "./profile-dropdown";

export default function ViewerBanner({
   children,
}: {
   children: React.ReactNode;
}) {
   const { data: session } = authClient.useSession();

   return (
      <div className="flex flex-col size-full">
         <header className="flex justify-between sticky top-0 w-full h-[var(--header-height)] z-50 bg-viewergray border-b border-viewerborder">
            <Link
               href="/home"
               className="flex items-center gap-2 ml-10 my-4 hover:text-gray-500 transition-colors"
            >
               <Image
                  src="/logo.png"
                  alt="S3 Viewer"
                  width={30}
                  height={30}
                  className="rounded-md"
                  priority
                  quality={100}
               />
               <span className="text-xl text-viewerblack font-bold">
                  S3Viewer
               </span>
            </Link>
            {session && (
               <div className="flex items-center mr-10">
                  <ProfileDropdown />
               </div>
            )}
         </header>
         <div className="h-[calc(100svh-var(--header-height))] w-full">
            {children}
         </div>
      </div>
   );
}
