import { useServers } from "@/lib/hooks/useServer";
import useConnectStore from "@/lib/stores/connectStore";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Server } from "lucide-react";

// Fields
import ServerDetected from "./detected";
import AccessKeyInput from "./fields/accesskey-input";
import EndpointInput from "./fields/endpoint-input";
import NameInput from "./fields/name-input";
import RegionInput from "./fields/region-input";
import SecretKeyInput from "./fields/secretkey-input";

// Buttons
import ResetButton from "./buttons/reset";
import SubmitButton from "./buttons/submit";

type ConnectModalProps = {
   onClose: () => void;
};

const ConnectModal: React.FC<ConnectModalProps> = ({ onClose }) => {
   const { serverFound, error: connectError } = useConnectStore();
   const { data, isLoading } = useServers();

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
            </div>
            {serverFound && <ServerDetected />}
            <DialogFooter className="flex flex-col justify-center">
               <SubmitButton onClose={onClose} />
               {serverFound && <ResetButton />}
            </DialogFooter>
            {connectError && <span className="text-red-500 text-sm">{connectError}</span>}
         </DialogContent>
      </Dialog>
   );
};

export default ConnectModal;
