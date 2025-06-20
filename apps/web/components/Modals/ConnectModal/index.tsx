import useConnectStore from "@/lib/stores/connectStore";
import { fetchServers } from "@/lib/utils/fetching";
import { ServerInfo } from "@s3-viewer/types";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { Server } from "lucide-react";

// Fields
import AccessKeyInput from "./fields/accesskey-input";
import EndpointInput from "./fields/endpoint-input";
import NameInput from "./fields/name-input";
import RegionInput from "./fields/region-input";
import SecretKeyInput from "./fields/secretkey-input";

// Buttons
import SubmitButton from "./buttons/submit";

type ConnectModalProps = {
   onClose: () => void;
};

const ConnectModal = ({ onClose }: ConnectModalProps) => {
   const { serverFound, error: connectError } = useConnectStore();
   const { data, isLoading, error } = useQuery<ServerInfo[]>({
      queryKey: ["servers-list"],
      queryFn: fetchServers,
   });

   const getDialogText = () => {
      if (isLoading || data?.length === 0) {
         return "Connect server to get started";
      }
      return "Connect new server";
   };

   const title = getDialogText();

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <DialogTitle>
                  <div className="flex flex-col gap-5 items-center">
                     <div className="bg-viewergray border border-xs rounded-2xl p-4">
                        <Server className="size-7 text-viewerblue" />
                     </div>
                     <span>{title}</span>
                  </div>
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>Enter credentials to link the server</span>
               </DialogDescription>
            </DialogHeader>
            <div className={serverFound ? "hidden" : "flex flex-col gap-4"}>
               <EndpointInput />
               <NameInput />
               <RegionInput />
               <AccessKeyInput />
               <SecretKeyInput />
               <SubmitButton />
            </div>
            {connectError && <span className="text-red-500">{connectError}</span>}
         </DialogContent>
      </Dialog>
   );
};

export default ConnectModal;
