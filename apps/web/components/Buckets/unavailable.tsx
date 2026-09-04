import {
   CredentialsErrorState,
   GridErrorState,
   RetryButton,
} from "@/components/DataGrid/overlays";
import { ApiError, errorMessage } from "@/lib/api";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { SITE_PATHS, isCredentialsErrorCode } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { FolderX } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import RemoveBucketDialog from "./remove-bucket-dialog";

type BucketUnavailableProps = {
   bucketName: string;
   error?: unknown;
   failedAt?: "buckets" | "objects";
   onRetry?: () => void;
   retrying?: boolean;
};

const GENERIC_TITLE = {
   buckets: "Couldn't load this bucket",
   objects: "Couldn't load objects",
} as const;

const NotFoundState = ({
   bucketName,
   onRetry,
   retrying,
}: BucketUnavailableProps) => {
   const router = useRouter();
   const canRemove = usePermission(Permission.DELETE_BUCKET);
   const [confirming, setConfirming] = useState(false);

   return (
      <GridErrorState
         icon={FolderX}
         title="Bucket unavailable"
         detail="You don't have permission to access this bucket, or it doesn't exist."
      >
         {canRemove && (
            <>
               <Button
                  variant="destructive"
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
         {onRetry && <RetryButton onRetry={onRetry} retrying={retrying} />}
      </GridErrorState>
   );
};

const BucketUnavailable = (props: BucketUnavailableProps) => {
   const { error, failedAt = "objects", onRetry, retrying } = props;
   if (
      error instanceof ApiError &&
      isCredentialsErrorCode(error.code) &&
      onRetry
   ) {
      return (
         <CredentialsErrorState
            message={error.message}
            onRetry={onRetry}
            retrying={retrying}
         />
      );
   }
   if (
      error === undefined ||
      (error instanceof ApiError && error.status === 404)
   ) {
      return <NotFoundState {...props} />;
   }
   return (
      <GridErrorState
         title={GENERIC_TITLE[failedAt]}
         detail={errorMessage(error)}
      >
         {onRetry && <RetryButton onRetry={onRetry} retrying={retrying} />}
      </GridErrorState>
   );
};

export default BucketUnavailable;
