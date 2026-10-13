import GithubIcon from "@/components/Auth/github-icon";
import Avatar from "@/components/avatar";
import { authClient, signOut } from "@/lib/auth";
import { SUPPORT_URL } from "@/lib/site-config";
import { isModifiedClick } from "@/lib/utils/events";
import { toastFailure } from "@/lib/utils/toast";
import { GITHUB_URL, SITE_PATHS } from "@s3-viewer/types";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuShortcut,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { LifeBuoy, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

const ProfileDropdown = () => {
   const { data: session } = authClient.useSession();
   const user = session?.user;
   const router = useRouter();
   const [open, setOpen] = useState(false);
   const modifiedClick = useRef(false);

   useEffect(() => {
      if (!open) return;
      const close = () => setOpen(false);
      router.events.on("routeChangeComplete", close);
      router.events.on("routeChangeError", close);
      return () => {
         router.events.off("routeChangeComplete", close);
         router.events.off("routeChangeError", close);
      };
   }, [open, router.events]);

   const holdOpenUntilRouted = (href: string) => (event: Event) => {
      if (modifiedClick.current || router.asPath === href) return;
      event.preventDefault();
   };

   if (!user) {
      return (
         <div
            aria-hidden="true"
            className="size-8 rounded-full bg-viewergray pointer-coarse:size-11"
         />
      );
   }

   return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
         <DropdownMenuTrigger
            aria-label="Account menu"
            className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none pointer-coarse:size-11 ${FOCUS_RING}`}
         >
            <Avatar name={user.name} />
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
            <DropdownMenuItem
               asChild
               onSelect={holdOpenUntilRouted(SITE_PATHS.settingsProfile)}
            >
               <Link
                  href={SITE_PATHS.settingsProfile}
                  onClick={(event) => {
                     modifiedClick.current = isModifiedClick(event);
                  }}
               >
                  <Settings aria-hidden="true" />
                  Settings
                  <DropdownMenuShortcut keys="g s" />
               </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
               <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <GithubIcon aria-hidden="true" />
                  View source
               </a>
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
               onSelect={() => void signOut().catch(toastFailure)}
            >
               <LogOut aria-hidden="true" />
               Sign out
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ProfileDropdown;
