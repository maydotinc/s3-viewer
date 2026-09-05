import DeleteAccountModal from "@/components/Modals/DeleteAccountModal";
import { useAccountSummary } from "@/lib/hooks/queries/user/useAccountSummary";
import { PRODUCT_NAME } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { toast } from "@s3-viewer/ui/components/toast";
import { useEffect, useState } from "react";
import SettingsCard from "./card";

// the summary loads with the page so the dialog opens fully formed; a click
// that lands before it arrives holds the button in its loading state instead
// of opening a dialog that would grow once the data lands
const DangerZoneCard = () => {
   const summary = useAccountSummary();
   const [confirming, setConfirming] = useState(false);
   const waiting = confirming && !summary.data;

   useEffect(() => {
      if (!waiting || !summary.error) return;
      toast.error(summary.error.message);
      setConfirming(false);
   }, [waiting, summary.error]);

   return (
      <SettingsCard
         title="Delete account"
         description={`Permanently removes your account and everything ${PRODUCT_NAME} stores about it: saved server connections, their credentials and your shared access. Your buckets, files and S3 servers are never touched.`}
         className="border-viewertextred/30"
      >
         <div>
            <Button
               variant="destructive"
               loading={waiting}
               onClick={() => setConfirming(true)}
            >
               Delete account
            </Button>
         </div>
         {confirming && summary.data && (
            <DeleteAccountModal
               summary={summary.data}
               onClose={() => setConfirming(false)}
            />
         )}
      </SettingsCard>
   );
};

export default DangerZoneCard;
