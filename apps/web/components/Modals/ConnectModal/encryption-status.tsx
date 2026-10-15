import StatusMessage, { RetryButton } from "@/components/status-message";
import useInstanceConfig, {
   encryptionNotice,
   type EncryptionState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { CircleAlert, ShieldAlert } from "lucide-react";

const EncryptionStatus = ({
   state,
}: {
   state: Exclude<EncryptionState, "loading">;
}) => {
   const config = useInstanceConfig();
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
