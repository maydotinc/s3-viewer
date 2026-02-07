import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@s3-viewer/ui/components/tabs-slider";
import InvitesHeader from "./Header";
import ReceivedInvites from "./Received";
import SentInvites from "./Sent";

const Invites = () => {
   return (
      <div className="size-full flex flex-col bg-viewerwhite">
         <InvitesHeader />
         <section className="flex flex-col p-8 py-6 w-full h-full">
            <Tabs defaultValue="received" className="size-full">
               <TabsList className="w-full">
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
         </section>
      </div>
   );
};

export default Invites;
