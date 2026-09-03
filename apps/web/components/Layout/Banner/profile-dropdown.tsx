import Avatar from "@/components/Avatar";
import DeleteAccountModal from "@/components/Modals/DeleteAccountModal";
import { authClient, signOut } from "@/lib/auth";
import { TERMS_URL } from "@/lib/site-config";
import { SITE_PATHS } from "@s3-viewer/types";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { ChevronDown, FileText, LogOut, Mail, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const ProfileDropdown = () => {
   const { data: session } = authClient.useSession();
   const [confirmingDelete, setConfirmingDelete] = useState(false);
   const user = session?.user;

   if (!user) {
      return (
         <div className="flex h-11 w-11 items-center justify-center rounded-full border border-viewerborder bg-viewerwhite sm:w-36">
            <Spinner size="sm" label="Loading account" />
         </div>
      );
   }

   return (
      <>
         <DropdownMenu>
            <DropdownMenuTrigger
               aria-label="Account menu"
               className="fade-in flex h-11 items-center gap-2 rounded-full border border-viewerborder bg-viewerwhite py-1 pl-1 pr-1 text-sm sm:pr-3 text-viewerblack outline-none hover:bg-viewergray focus-visible:border-viewerblue data-[state=open]:[&_svg]:rotate-180"
            >
               <Avatar name={user.name} image={user.image} size={36} />
               <span className="hidden max-w-32 truncate sm:inline">
                  {user.name}
               </span>
               <ChevronDown
                  aria-hidden="true"
                  className="size-4 text-viewertext transition-transform"
               />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
               <DropdownMenuLabel className="flex flex-col font-normal">
                  <span className="text-xs text-viewerlighttext">
                     Signed in as
                  </span>
                  <span className="truncate text-viewerblack">
                     {user.email}
                  </span>
               </DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem asChild>
                  <Link href={SITE_PATHS.invites}>
                     <Mail aria-hidden="true" />
                     Invites
                  </Link>
               </DropdownMenuItem>
               <DropdownMenuItem asChild>
                  <a href={TERMS_URL} target="_blank" rel="noreferrer">
                     <FileText aria-hidden="true" />
                     Terms of service
                  </a>
               </DropdownMenuItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => signOut()}
               >
                  <LogOut aria-hidden="true" />
                  Sign out
               </DropdownMenuItem>
               <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirmingDelete(true)}
               >
                  <Trash2 aria-hidden="true" />
                  Delete account
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
         {confirmingDelete && (
            <DeleteAccountModal onClose={() => setConfirmingDelete(false)} />
         )}
      </>
   );
};

export default ProfileDropdown;
