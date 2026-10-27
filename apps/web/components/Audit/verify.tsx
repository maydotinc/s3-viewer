import { api, qs, serverPath } from "@/lib/api";
import { useAbortableTask } from "@/lib/hooks/useAbortableTask";
import useSessionStore, { useUserId } from "@/lib/stores/session-store";
import { toastFailure } from "@/lib/utils/toast";
import type { AuditVerification } from "@s3-viewer/shared";
import { Button } from "@s3-viewer/ui/components/button";
import { toast } from "@s3-viewer/ui/components/toast";
import { ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { verificationMessage } from "./labels";

type VerifyProps = { serverId: string; disabled: boolean };

const VerificationSession = ({
   userId,
   serverId,
   disabled,
}: VerifyProps & { userId: string }) => {
   const task = useAbortableTask();
   const active = useRef(false);
   const [pending, setPending] = useState(false);
   const [verification, setVerification] = useState<AuditVerification | null>(
      null
   );
   const fromSeq = verification?.ok ? verification.nextFromSeq : null;
   const message = verification ? verificationMessage(verification) : undefined;
   const isCurrent = () => {
      const current = useSessionStore.getState();
      return current.userId === userId && current.serverId === serverId;
   };

   const verify = async () => {
      if (active.current || disabled || !isCurrent()) return;
      active.current = true;
      setPending(true);
      if (fromSeq === null) setVerification(null);
      const signal = task.start();
      try {
         const result = await api.get<AuditVerification>(
            `${serverPath(serverId)}/audit/verify${qs({ fromSeq: fromSeq ?? undefined })}`,
            signal
         );
         if (signal.aborted || !isCurrent()) return;
         if (
            result.nextFromSeq !== null &&
            (!Number.isSafeInteger(result.nextFromSeq) ||
               result.nextFromSeq <= (fromSeq ?? 0) ||
               result.lastSeq !== result.nextFromSeq)
         )
            throw new Error("Verification did not advance. Try again.");
         const checked = {
            ...result,
            rows: result.rows + (fromSeq ? (verification?.rows ?? 0) : 0),
            firstSeq: fromSeq
               ? (verification?.firstSeq ?? result.firstSeq)
               : result.firstSeq,
            lastSeq:
               result.lastSeq ??
               (fromSeq ? (verification?.lastSeq ?? null) : null),
         };
         task.ifMounted(() => {
            setVerification(checked);
            if (!checked.ok) toast.error(verificationMessage(checked));
            else if (checked.nextFromSeq === null)
               toast.success(verificationMessage(checked));
         });
      } catch (error) {
         if (!signal.aborted && isCurrent())
            task.ifMounted(() => toastFailure(error));
      } finally {
         active.current = false;
         task.ifMounted(() => setPending(false));
      }
   };

   return (
      <div className="flex max-w-full min-w-40 flex-1 flex-col items-start gap-1 sm:w-56 sm:flex-none">
         <Button
            type="button"
            variant="outline"
            className="w-full"
            loading={pending}
            disabled={disabled}
            onClick={() => void verify()}
         >
            <ShieldCheck aria-hidden="true" />
            {fromSeq ? "Continue verification" : "Verify integrity"}
         </Button>
         <p
            role="status"
            title={message}
            className="h-4 w-full truncate text-xs leading-4 text-viewertext"
         >
            {message}
         </p>
      </div>
   );
};

const VerifyButton = (props: VerifyProps) => {
   const userId = useUserId();
   return (
      <VerificationSession
         key={JSON.stringify([userId, props.serverId])}
         userId={userId}
         {...props}
      />
   );
};

export default VerifyButton;
