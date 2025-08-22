import { useModalContext } from "@/lib/contexts/ModalContext";
import { authClient } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import { LogInIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ProfileDropdown from "./profile-dropdown";

export default function ViewerBanner({
   children,
}: {
   children: React.ReactNode;
}) {
   const { data: session } = authClient.useSession();
   const { openAuthModal } = useModalContext();
   return (
      <div className="flex flex-col size-full">
         <header className="flex justify-between sticky top-0 w-full h-[var(--header-height)] z-50 bg-viewergray border-b border-viewerborder">
            <Link
               href="/dashboard"
               className="flex items-center gap-2 ml-10 my-4"
            >
               <Image
                  src="/icons/viewer.svg"
                  alt="S3 Viewer"
                  width={150}
                  height={32}
                  priority
                  quality={100}
               />
            </Link>
            {session ? (
               <div className="flex items-center mr-10">
                  <ProfileDropdown />
               </div>
            ) : (
               <div className="flex items-center mr-10">
                  <Button onClick={() => openAuthModal()}>
                     <LogInIcon className="size-4" />
                     Login
                  </Button>
               </div>
            )}
         </header>
         <div className="h-[calc(100svh-var(--header-height))] w-full">
            {children}
         </div>
      </div>
   );
}
