import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@s3-viewer/ui/components/dialog";
import { FolderPen, PenLine } from "lucide-react";
import { useState } from "react";
import SubmitButton from "./buttons/submit";
import NameInput from "./fields/name-input";

type ServerEditProps = {
   serverId: string;
};

const ServerEdit = ({ serverId }: ServerEditProps) => {
   const [isOpen, setIsOpen] = useState(false);
   const [serverName, setServerName] = useState("");

   return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
         <DialogTrigger className="w-full">
            <div className="flex items-center gap-2 cursor-pointer size-full">
               <PenLine className="size-4" />
               Edit
            </div>
         </DialogTrigger>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden">
            <DialogHeader className="flex flex-col gap-2 items-center text-center">
               <DialogTitle>
                  <div className="flex flex-col gap-5 items-center">
                     <div className="bg-viewergray border border-xs rounded-2xl p-4">
                        <FolderPen className="size-7 text-viewerblue" />
                     </div>
                     <span>Rename Server</span>
                  </div>
               </DialogTitle>
               <DialogDescription>Enter new name to rename the server</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
               <NameInput serverName={serverName} setServerName={setServerName} />
               <SubmitButton serverId={serverId} serverName={serverName} />
            </div>
         </DialogContent>
      </Dialog>
   );
};

export default ServerEdit;
