import { authClient, signOut } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import { Separator } from "@s3-viewer/ui/components/separator";
import { cn, stringToColor } from "@s3-viewer/ui/lib/utils";
import { ChevronDown, FileText, LogOut, Mail } from "lucide-react";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";

const SETTINGS_OPTIONS = [
   { id: "terms", title: "Terms of Service", icon: <FileText /> },
   { id: "invites", title: "Invites", icon: <Mail /> },
   { id: "logout", title: "Logout", icon: <LogOut /> },
] as const;

const ProfileDropdown: React.FC = () => {
   const router = useRouter();
   const { data } = authClient.useSession();
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
               router.push("/invites");
               break;
            case "logout":
               await signOut();
               break;
         }
      },
      [router, signOut]
   );

   return (
      <div ref={dropdownRef} className="relative">
         <Button
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-10 w-auto items-center gap-2 rounded-full border border-gray-300 bg-white p-1 !px-2 hover:bg-gray-100 focus:outline-none sm:p-2 md:h-11"
         >
            <span
               className="flex text-xs items-center justify-center rounded-full w-8 h-8 font-bold text-white"
               style={{
                  backgroundColor: stringToColor(user?.email ?? ""),
               }}
            >
               {user?.email?.slice(0, 2).toUpperCase() ?? "??"}
            </span>
            <ChevronDown
               className={cn(
                  "h-3 w-3 text-gray-600 transition-transform duration-200 sm:h-4 sm:w-4",
                  { "rotate-180": isOpen }
               )}
            />
         </Button>
         {isOpen && (
            <div className="absolute right-0 mt-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg animate-in fade-in-80 slide-in-from-top-5 sm:mt-2 sm:w-60">
               <div className="flex flex-col items-start justify-start min-w-0 w-full px-3 py-2">
                  <p className="text-xs text-gray-500 max-w-full truncate">
                     Signed in as
                  </p>
                  <p className="truncate text-black max-w-full">
                     {user?.email || "No email found"}
                  </p>
               </div>

               <Separator orientation="horizontal" className="w-full" />

               <div className="flex w-full flex-col">
                  {SETTINGS_OPTIONS.map((option) => (
                     <Button
                        variant="ghost"
                        className={cn(
                           "w-full hover:bg-viewergray flex items-center justify-start gap-2 text-gray-800 rounded-none h-10",
                           option.id === "logout" &&
                              "text-red-500 rounded-b-lg hover:text-red-500"
                        )}
                        onClick={() => handleOptionSelect(option.id)}
                        key={option.id}
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
