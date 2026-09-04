import OtpInput from "@/components/Auth/otp-input";
import ResendLink from "@/components/Auth/resend-link";
import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import { sendVerificationCode, verifyEmail } from "@/lib/auth";
import { useUserId } from "@/lib/stores/sessionStore";
import { AUTH_CODE_LENGTH } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";

type VerifyEmailDialogProps = { email: string; onClose: () => void };

const VerifyEmailDialog = ({ email, onClose }: VerifyEmailDialogProps) => {
   const userId = useUserId();
   const queryClient = useQueryClient();
   const [code, setCode] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);

   // one code goes out when the dialog opens; the resend link covers the
   // rest. The ref keeps a re-run of the effect (strict mode, a re-render)
   // from issuing a second code that would race the first in the store
   const sent = useRef(false);
   useEffect(() => {
      if (sent.current) return;
      sent.current = true;
      void sendVerificationCode(email).then(({ error: sendError }) => {
         if (sendError) setError(sendError);
      });
   }, [email]);

   const submit = async (event: FormEvent) => {
      event.preventDefault();
      if (code.length !== AUTH_CODE_LENGTH) {
         setError(`Enter the ${AUTH_CODE_LENGTH}-digit code from your email.`);
         return;
      }
      setPending(true);
      const { error: verifyError } = await verifyEmail(email, code);
      if (verifyError) {
         setError(verifyError);
         setCode("");
         setPending(false);
         return;
      }
      // invites were refused while unverified; every user query is cheap to redo
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
      toast.success("Email verified");
      onClose();
   };

   return (
      <FormDialog
         title="Verify your email"
         description={`Enter the code we sent to ${email}.`}
         isPending={pending}
         onClose={onClose}
         onSubmit={(event) => void submit(event)}
         submitLabel="Verify"
         submitDisabled={code.length !== AUTH_CODE_LENGTH}
         bodyClassName="flex flex-col gap-4"
      >
         <div className="flex flex-col gap-1.5">
            <OtpInput
               value={code}
               onChange={(next) => {
                  setCode(next);
                  if (error) setError(null);
               }}
               onComplete={() => undefined}
               disabled={pending}
               invalid={Boolean(error)}
            />
            <FormError>{error}</FormError>
         </div>
         <p className="text-sm text-viewertext">
            <ResendLink
               onResend={() => sendVerificationCode(email)}
               onError={setError}
               onSent={() => setCode("")}
               disabled={pending}
            />
         </p>
      </FormDialog>
   );
};

export default VerifyEmailDialog;
