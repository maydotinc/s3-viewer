import StatusMessage, { RetryButton } from "@/components/status-message";
import useInstanceConfig, {
   encryptionNotice,
   type EncryptionState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { CircleAlert, ShieldAlert } from "lucide-react";

const EncryptionStatus = ({ state }: { state: EncryptionState }) => {
   const config = useInstanceConfig();
   if (state === "loading")
      return <Spinner label="Loading instance settings" />;
   const notice = encryptionNotice(state);
   if (!notice) return null;
   return state === "insecure" ? (
      <StatusMessage
         icon={ShieldAlert}
         tone="error"
         title="This connection isn't secure"
      >
         {notice}
      </StatusMessage>
   ) : (
      <StatusMessage
         icon={CircleAlert}
         tone="error"
         title="Couldn't load instance settings"
         actions={
            <RetryButton
               size="sm"
               retrying={config.isFetching}
               onRetry={() => void config.refetch()}
            />
         }
      >
         Check your connection and try again.
      </StatusMessage>
   );
};

export { EncryptionStatus };
