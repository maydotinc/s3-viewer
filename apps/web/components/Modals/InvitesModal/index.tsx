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
import { InvitesProvider, useInvitesContext } from "./context/InvitesContext";
import ReceivedInvites from "./received";
import SentInvites from "./sent";

type InvitesModalProps = {
   onClose: () => void;
};

const InvitesModalContent: React.FC = () => {
   const { activeTab, setActiveTab } = useInvitesContext();

   return (
      <div className="flex flex-col gap-4 px-4">
         <Tabs
            value={activeTab}
            onValueChange={(value) =>
               setActiveTab(value as "received" | "sent")
            }
         >
            <TabsList className="grid w-full grid-cols-2">
               <TabsTrigger value="received">Received</TabsTrigger>
               <TabsTrigger value="sent">Sent</TabsTrigger>
            </TabsList>
            <TabsContent value="received" className="mt-4">
               <ReceivedInvites />
            </TabsContent>
            <TabsContent value="sent" className="mt-4">
               <SentInvites />
            </TabsContent>
         </Tabs>
      </div>
   );
};

const InvitesModal: React.FC<InvitesModalProps> = ({ onClose }) => {
   return (
      <InvitesProvider onClose={onClose}>
         <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-xl px-0 lg:max-w-2xl overflow-hidden">
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
               <InvitesModalContent />
            </DialogContent>
         </Dialog>
      </InvitesProvider>
   );
};

export default InvitesModal;
