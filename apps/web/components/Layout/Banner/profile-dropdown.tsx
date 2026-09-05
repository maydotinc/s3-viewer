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
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type MouseEvent } from "react";

const isModifiedClick = (event: MouseEvent) =>
   event.metaKey ||
   event.ctrlKey ||
   event.shiftKey ||
   event.altKey ||
   event.button !== 0;

const ProfileDropdown = () => {
   const { data: session } = authClient.useSession();
   const user = session?.user;
   const router = useRouter();
   const [open, setOpen] = useState(false);
   // written by the link's own click handler, which runs before radix selects
   // the item, so `onSelect` knows the browser is handling the click.
   const modifiedClick = useRef(false);

   // the menu stays up until the new page renders, instead of vanishing first
   // and leaving the old page on screen until the route resolves.
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
            className="size-8 rounded-full bg-viewergray"
         />
      );
   }

   return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
         <DropdownMenuTrigger
            aria-label="Account menu"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none"
         >
            <Avatar name={user.name} size={32} />
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
               <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
                  <LifeBuoy aria-hidden="true" />
                  Support
               </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
               variant="destructive"
               onSelect={() =>
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
