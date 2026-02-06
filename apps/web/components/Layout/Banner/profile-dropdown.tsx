import { useModalContext } from "@/lib/contexts/ModalContext";
import { authClient, signOut } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import { Separator } from "@s3-viewer/ui/components/separator";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ChevronDown,
   FileText,
   Headset,
   LogOut,
   Mail,
   User,
} from "lucide-react";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";

const SETTINGS_OPTIONS = [
   { id: "help", title: "Help & Support", icon: <Headset /> },
   { id: "terms", title: "Terms of Service", icon: <FileText /> },
   { id: "invites", title: "Invites", icon: <Mail /> },
   { id: "logout", title: "Logout", icon: <LogOut /> },
] as const;

const ProfileDropdown: React.FC = () => {
   const { data } = authClient.useSession();
   const { openInvitesModal } = useModalContext();
   const user = data?.user;

   const [isOpen, setIsOpen] = useState(false);
   const dropdownRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const handleOutsideClick = (event: MouseEvent) => {
         if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node)
         ) {
            setIsOpen(false);
         }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
         if (event.key === "Escape") {
            event.preventDefault();
            setIsOpen(false);
         }
      };

      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
         document.removeEventListener("mousedown", handleOutsideClick);
         document.removeEventListener("keydown", handleKeyDown);
      };
   }, []);

   const handleOptionSelect = useCallback(
      async (optionId: "help" | "terms" | "invites" | "logout") => {
         setIsOpen(false);
         switch (optionId) {
            case "help":
               console.log("help");
               break;
            case "terms":
               window.open("https://s3-viewer.com/tos", "_blank");
               break;
            case "invites":
               openInvitesModal();
               break;
            case "logout":
               await signOut();
               break;
         }
      },
      [openInvitesModal, signOut]
   );

   return (
      <div ref={dropdownRef} className="relative">
         <Button
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-10 w-auto items-center space-x-4 rounded-full border border-gray-300 bg-white p-1 !px-2 hover:bg-gray-100 focus:outline-none sm:p-2 md:h-11 md:space-x-2.5"
         >
            {user?.image ? (
               <Image
                  src={user.image}
                  alt="Profile"
                  className="size-8 rounded-full object-cover"
               />
            ) : (
               <User className="size-8 rounded-full bg-blue-400 p-1 text-viewergray" />
            )}
            <span className="text-black truncate">{user?.name}</span>
            <ChevronDown
               className={cn(
                  "h-3 w-3 text-gray-600 transition-transform duration-200 sm:h-4 sm:w-4",
                  {
                     "rotate-180": isOpen,
                  }
               )}
            />
         </Button>
         {isOpen && (
            <div className="absolute right-0 mt-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg animate-in fade-in-80 slide-in-from-top-5 sm:mt-2 sm:w-60">
               <div className="flex flex-row items-center gap-2 w-full p-2">
                  {user?.image ? (
                     <Image
                        src={user.image}
                        alt="Profile"
                        className="size-10 rounded-full object-cover min-w-10"
                     />
                  ) : (
                     <User className="size-10 rounded-full bg-blue-400 p-1 min-w-10 text-viewergray" />
                  )}
                  <div className="flex flex-col items-start justify-start min-w-0 w-full">
                     <p className="truncate text-black max-w-full">
                        {user?.name || "User"}
                     </p>
                     <p className="text-xs max-w-full truncate text-gray-500">
                        {user?.email || "No email found"}
                     </p>
                  </div>
               </div>

               <Separator orientation="horizontal" className="w-full" />

               <div className="flex w-full flex-col">
                  {SETTINGS_OPTIONS.map((option) => (
                     <Button
                        variant="ghost"
                        className={cn(
                           "w-full hover:bg-viewergray flex items-center justify-start gap-2 text-gray-800 rounded-none",
                           option.id === "logout" &&
                              "text-red-500 rounded-b-lg hover:text-red-500"
                        )}
                        onClick={() => handleOptionSelect(option.id)}
                     >
                        {option.icon}
                        {option.title}
                     </Button>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
};

export default ProfileDropdown;
