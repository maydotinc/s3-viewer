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
import React, { useEffect, useRef, useState } from "react";

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

   const handleOptionSelect = async (
      optionId: "help" | "terms" | "invites" | "logout"
   ) => {
      setIsOpen(false);
      switch (optionId) {
         case "help":
            console.log("help");
            break;
         case "terms":
            console.log("terms");
            break;
         case "invites":
            openInvitesModal();
            break;
         case "logout":
            await signOut();
            break;
      }
   };

   return (
      <div ref={dropdownRef} className="relative">
         <Button
            onClick={() => setIsOpen(!isOpen)}
            className="flex max-w-[150px] items-center justify-between gap-2 rounded-full border border-gray-300 bg-viewerwhite !pl-0.5 hover:bg-gray-100 focus:outline-none"
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
            <div className="absolute flex flex-col gap-2 right-0 mt-1 min-w-[300px] rounded-xl p-2 border border-viewerborder bg-viewerwhite shadow-lg animate-in fade-in-80 slide-in-from-top-5">
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
                  <div className="flex flex-col items-start justify-start">
                     <p className="truncate max-w-[200px] text-black">
                        {user?.name}
                     </p>
                     <p className="text-xs max-w-[200px] truncate text-gray-500">
                        {user?.email}
                     </p>
                  </div>
               </div>

               <Separator orientation="horizontal" className="w-full" />

               <div className="flex w-full flex-col gap-2">
                  {SETTINGS_OPTIONS.map((option) =>
                     option.id === "logout" ? (
                        <div
                           key={option.id}
                           className="w-full flex flex-col gap-2"
                        >
                           <Separator
                              orientation="horizontal"
                              className="w-full"
                           />
                           <Button
                              variant="ghost"
                              className="w-full hover:bg-viewergray flex items-center justify-start gap-2 text-black"
                              onClick={() => handleOptionSelect(option.id)}
                           >
                              {option.icon}
                              {option.title}
                           </Button>
                        </div>
                     ) : (
                        <Button
                           variant="ghost"
                           key={option.id}
                           className="w-full hover:bg-viewergray flex items-center justify-start gap-2 text-black"
                           onClick={() => handleOptionSelect(option.id)}
                        >
                           {option.icon}
                           {option.title}
                        </Button>
                     )
                  )}
                  <span className="text-xs text-gray-500 p-2">
                     v0.0.0 - S3 Viewer
                  </span>
               </div>
            </div>
         )}
      </div>
   );
};

export default ProfileDropdown;
