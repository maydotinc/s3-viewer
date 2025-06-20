import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@s3-viewer/ui/components/dialog";
import { PenLine, Server } from "lucide-react";
import { useState } from "react";

const ServerEdit = () => {
   const [isOpen, setIsOpen] = useState(false);

   return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
         <DialogTrigger className="w-full">
            <div className="flex items-center gap-2 cursor-pointer size-full">
               <PenLine className="size-4" />
               Edit
            </div>
         </DialogTrigger>
         <DialogContent>
            <DialogHeader className="flex flex-col gap-2 items-center text-center">
               <div className="bg-viewergray border border-viewerborder rounded-2xl p-3 mb-2">
                  <Server className="size-10 text-viewerblue" />
               </div>
               <DialogTitle>Edit Server</DialogTitle>
               <DialogDescription>Enter new credentials to edit the server</DialogDescription>
            </DialogHeader>
         </DialogContent>
      </Dialog>
   );
};

export default ServerEdit;
