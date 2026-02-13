import { ServerInfo } from "@s3-viewer/types";
import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { XIcon } from "lucide-react";
import InviteButton from "./buttons/invite";
import { ShareProvider } from "./context/ShareContext";
import BucketAccessPicker from "./fields/bucket-access-picker";
import EmailRoleInput from "./fields/email-role-input";
import UserList from "./user-list";

type ShareModalProps = {
   onClose: () => void;
   server?: ServerInfo;
};

const ShareModal: React.FC<ShareModalProps> = ({ onClose, server }) => {
   return (
      <ShareProvider serverId={server?.id} onClose={onClose}>
         <Dialog open={true} onOpenChange={onClose}>
            <DialogContent
               showCloseButton={false}
               className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden px-0 pt-0"
               onOpenAutoFocus={(e) => e.preventDefault()}
               aria-describedby={undefined}
            >
               <DialogHeader className="text-left flex flex-row justify-between px-4 py-4 border-b border-viewerborder">
                  <DialogTitle className="text-lg text-viewerblack">
                     Share {server && server.name ? (
                        <span className="font-medium !text-[#002a84]">{server.name}</span>
                     ) : (
                        "this server"
                     )} with team
                  </DialogTitle>
                  <DialogClose className="data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
                     <XIcon />
                     <span className="sr-only">Close</span>
                  </DialogClose>
               </DialogHeader>
               <div className="flex flex-col gap-4 px-4 pb-4">
                  <div className="flex flex-col border border-viewerborder rounded-2xl p-3 gap-3">
                     <EmailRoleInput />
                     <BucketAccessPicker />
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
