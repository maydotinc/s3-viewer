import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@s3-viewer/ui/components/tabs";
import { XIcon } from "lucide-react";
import { useEffect } from "react";
import { InvitesProvider, useInvitesContext } from "./context/InvitesContext";
import ReceivedInvites from "./received";
import SentInvites from "./sent";

type InvitesModalProps = {
   onClose: () => void;
};

const InvitesModalContent: React.FC = () => {
   const { activeTab, setActiveTab, refreshInvites } = useInvitesContext();

   useEffect(() => {
      refreshInvites();
   }, []);

   return (
      <div className="flex flex-col gap-4 px-4 pb-4">
         <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "received" | "sent")}
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
            <DialogContent
               showCloseButton={false}
               className="max-w-[95%] xs:max-w-lg sm:max-w-xl lg:max-w-2xl overflow-hidden px-0 pt-0"
               onOpenAutoFocus={(e) => e.preventDefault()}
               aria-describedby={undefined}
            >
               <DialogHeader className="text-left flex flex-row justify-between px-4 py-4 border-b border-viewerborder">
                  <DialogTitle className="text-lg text-viewerblack">Manage Invites</DialogTitle>
                  <DialogClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
                     <XIcon />
                     <span className="sr-only">Close</span>
                  </DialogClose>
               </DialogHeader>
               <InvitesModalContent />
            </DialogContent>
         </Dialog>
      </InvitesProvider>
   );
};

export default InvitesModal;
