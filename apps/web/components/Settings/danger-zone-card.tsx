import DeleteAccountModal from "@/components/Modals/DeleteAccountModal";
import { Button } from "@s3-viewer/ui/components/button";
import { useState } from "react";
import SettingsCard from "./card";

const DangerZoneCard = () => {
   const [confirming, setConfirming] = useState(false);
   return (
      <SettingsCard
         title="Delete account"
         description="Permanently deletes your account, every server you own and your access to servers shared with you; buckets and files in your storage are not touched."
         className="border-viewertextred/30"
      >
         <div>
            <Button variant="destructive" onClick={() => setConfirming(true)}>
               Delete account
            </Button>
         </div>
         {confirming && (
            <DeleteAccountModal onClose={() => setConfirming(false)} />
         )}
      </SettingsCard>
   );
};

export default DangerZoneCard;
