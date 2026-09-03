import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { SITE_PATHS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { ShieldX } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import RemoveBucketDialog from "./remove-bucket-dialog";

const BucketUnavailable = ({ bucketName }: { bucketName: string }) => {
   const router = useRouter();
   const canRemove = usePermission(Permission.DELETE_BUCKET);
   const [confirming, setConfirming] = useState(false);

   return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
         <ShieldX className="size-10 text-viewertextred" aria-hidden="true" />
         <p className="text-heading">Bucket unavailable</p>
         <p className="max-w-md text-sm text-viewertext">
            You don&apos;t have permission to access this bucket, or it
            doesn&apos;t exist.
         </p>
         {canRemove && (
            <>
               <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirming(true)}
               >
                  Remove bucket
               </Button>
               <RemoveBucketDialog
                  bucketName={bucketName}
                  open={confirming}
                  onOpenChange={setConfirming}
                  onRemoved={() => void router.replace(SITE_PATHS.dashboard)}
               />
            </>
         )}
      </div>
   );
};

export default BucketUnavailable;
