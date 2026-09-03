import Avatar from "@/components/Avatar";
import { authClient, signOut } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { SUPPORT_URL } from "@/lib/site-config";
import { SITE_PATHS } from "@s3-viewer/types";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuShortcut,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { toast } from "@s3-viewer/ui/components/toast";
import { LifeBuoy, LogOut, Settings } from "lucide-react";
import Link from "next/link";

const ProfileDropdown = () => {
   const { data: session } = authClient.useSession();
   const user = session?.user;

   // Same footprint as the trigger so the banner never shifts.
   if (!user) {
      return (
         <div
            aria-hidden="true"
            className="size-8 rounded-full bg-viewergray"
         />
      );
   }

   return (
      <DropdownMenu>
         <DropdownMenuTrigger
            aria-label="Account menu"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none"
         >
            <Avatar name={user.name} image={user.image} size={32} />
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end" className="min-w-[14rem]">
            <div className="flex flex-col px-2.5 py-2">
               <span className="truncate text-sm font-medium text-viewerblack">
                  {user.name}
               </span>
               <span className="truncate text-xs text-viewertext">
                  {user.email}
               </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
               <Link href={SITE_PATHS.settingsProfile}>
                  <Settings aria-hidden="true" />
                  Settings
                  <DropdownMenuShortcut keys="g s" />
               </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
               <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
                  <LifeBuoy aria-hidden="true" />
                  Support
               </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
               variant="destructive"
               onSelect={() =>
                  // signOut always clears local state and navigates to
                  // /login, even when the request fails; just report it.
                  void signOut().catch((error: unknown) =>
                     toast.error(errorMessage(error))
                  )
               }
            >
               <LogOut aria-hidden="true" />
               Sign out
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ProfileDropdown;
