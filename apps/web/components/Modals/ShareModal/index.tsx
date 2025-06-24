import { ServerInfo } from "@s3-viewer/types";
import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Separator } from "@s3-viewer/ui/components/separator";
import { XIcon } from "lucide-react";
import InviteButton from "./buttons/invite";
import { ShareProvider } from "./context/ShareContext";
import EmailRoleInput from "./fields/email-role-input";
import UserList from "./user-list";

type ShareModalProps = {
   onClose: () => void;
   server?: ServerInfo;
};

const ShareModal: React.FC<ShareModalProps> = ({ onClose, server }) => {
   return (
      <ShareProvider serverId={server?.id}>
         <Dialog open={true} onOpenChange={onClose}>
            <DialogContent
               showCloseButton={false}
               className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden px-0 pt-0"
               onOpenAutoFocus={(e) => e.preventDefault()}
               aria-describedby={undefined}
            >
               <DialogHeader className="text-left flex flex-row justify-between px-4 pt-4">
                  <DialogTitle className="text-lg text-viewerblack">
                     Share server with team
                  </DialogTitle>
                  <DialogClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
                     <XIcon />
                     <span className="sr-only">Close</span>
                  </DialogClose>
               </DialogHeader>
               <Separator orientation="horizontal" />
               <div className="flex flex-col gap-4 px-4">
                  <div className="flex flex-col border border-viewerborder rounded-2xl p-3 gap-3">
                     <EmailRoleInput />
                     <InviteButton />
                  </div>
                  <UserList />
               </div>
            </DialogContent>
         </Dialog>
      </ShareProvider>
   );
};

export default ShareModal;
