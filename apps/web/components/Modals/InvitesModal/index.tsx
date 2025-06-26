import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@s3-viewer/ui/components/tabs";
import ReceivedInvites from "./received";
import SentInvites from "./sent";

type InvitesModalProps = {
   onClose: () => void;
};

const InvitesModal: React.FC<InvitesModalProps> = ({ onClose }) => {
   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] flex flex-col xs:max-w-lg sm:max-w-xl px-0 overflow-hidden py-4">
            <DialogHeader className="flex pb-4 flex-col items-center text-center gap-2 border-b border-viewerborder">
               <DialogTitle className="flex flex-col gap-5 items-center">
                  <span>Manage Invites</span>
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>
                     Manage all of your sent and recieved server invites.
                  </span>
               </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col px-4">
               <Tabs defaultValue="received">
                  <TabsList className="grid w-full grid-cols-2">
                     <TabsTrigger value="received">Received</TabsTrigger>
                     <TabsTrigger value="sent">Sent</TabsTrigger>
                  </TabsList>
                  <TabsContent value="received">
                     <ReceivedInvites />
                  </TabsContent>
                  <TabsContent value="sent">
                     <SentInvites />
                  </TabsContent>
               </Tabs>
            </div>
         </DialogContent>
      </Dialog>
   );
};

export default InvitesModal;
