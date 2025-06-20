import { useModalContext } from "@/lib/contexts/ModalContext";
import { ServerInfo } from "@s3-viewer/types";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronRight, PenLine, WifiOff } from "lucide-react";
import { useState } from "react";

type ServerActionsProps = {
   server: ServerInfo;
};

const ServerActions = ({ server }: ServerActionsProps) => {
   const [isOpen, setIsOpen] = useState(false);
   const { openModal } = useModalContext();

   return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
         <DropdownMenuTrigger>
            <ChevronRight
               className={cn("size-4 transition-transform duration-200", { "rotate-180": isOpen })}
            />
         </DropdownMenuTrigger>
         <DropdownMenuContent
            side="right"
            align="start"
            onCloseAutoFocus={(e) => e.preventDefault()}
         >
            <DropdownMenuItem
               className="flex items-center gap-2 cursor-pointer size-full"
               onSelect={(e) => {
                  e.preventDefault();
                  openModal("rename", { server });
               }}
            >
               <PenLine className="size-4" />
               Rename
            </DropdownMenuItem>
            <DropdownMenuItem
               variant="destructive"
               className="flex items-center gap-2 cursor-pointer size-full"
               onSelect={(e) => {
                  e.preventDefault();
                  openModal("disconnect", { server });
               }}
            >
               <WifiOff className="size-4 text-viewertextred" />
               Disconnect
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ServerActions;
