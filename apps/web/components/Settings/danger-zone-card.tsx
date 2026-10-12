import DeleteAccountModal from "@/components/Modals/DeleteAccountModal";
import { useAccountSummary } from "@/lib/hooks/queries/user/useAccountSummary";
import { PRODUCT_NAME } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { toast } from "@s3-viewer/ui/components/toast";
import { useEffect, useState } from "react";
import SettingsCard from "./card";

const DangerZoneCard = () => {
   const summary = useAccountSummary();
   const [confirming, setConfirming] = useState(false);
   const waiting = confirming && !summary.data;

   useEffect(() => {
      if (!waiting || !summary.error || summary.isFetching) return;
      toast.error(summary.error.message);
      setConfirming(false);
   }, [waiting, summary.error, summary.isFetching]);

   const confirm = () => {
      if (summary.isError) void summary.refetch();
      setConfirming(true);
   };

   return (
      <SettingsCard
         title="Delete account"
         description={`Permanently removes your account and everything ${PRODUCT_NAME} stores about it: saved server connections, their credentials and your shared access. Your buckets, files and S3 servers are never touched.`}
         className="border-viewertextred/30"
      >
         <div>
            <Button variant="destructive" loading={waiting} onClick={confirm}>
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
