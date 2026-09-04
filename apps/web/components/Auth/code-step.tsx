import OtpInput from "@/components/Auth/otp-input";
import ResendLink from "@/components/Auth/resend-link";
import type { AuthResult } from "@/lib/auth";
import { AUTH_CODE_LENGTH } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

type CodeStepProps = {
   onVerify: (code: string) => Promise<AuthResult>;
   onResend: () => Promise<AuthResult>;
   onVerified: () => Promise<void>;
   // an extra way out next to the resend link, e.g. "Skip for now"
   secondary?: ReactNode;
};

const CodeStep = ({
   onVerify,
   onResend,
   onVerified,
   secondary,
}: CodeStepProps) => {
   const [code, setCode] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [verifying, setVerifying] = useState(false);
   const inFlight = useRef(false);

   const verify = async (value: string) => {
      if (inFlight.current || value.length !== AUTH_CODE_LENGTH) return;
      inFlight.current = true;
      setVerifying(true);
      setError(null);
      const { error: verifyError } = await onVerify(value);
      if (verifyError) {
         setError(verifyError);
         setCode("");
         setVerifying(false);
         inFlight.current = false;
         return;
      }
      await onVerified();
   };

   const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (code.length !== AUTH_CODE_LENGTH) {
         setError(`Enter the ${AUTH_CODE_LENGTH}-digit code from your email.`);
         return;
      }
      void verify(code);
   };

   return (
      <form onSubmit={submit} className="flex flex-col gap-6">
         <div className="flex flex-col gap-2">
            <OtpInput
               value={code}
               onChange={(next) => {
                  setCode(next);
                  if (error) setError(null);
               }}
               onComplete={(complete) => void verify(complete)}
               disabled={verifying}
               invalid={Boolean(error)}
            />
            <p
               role="alert"
               className="min-h-5 text-sm leading-5 text-viewertextred"
            >
               {error}
            </p>
         </div>

         <Button type="submit" size="lg" className="w-full" loading={verifying}>
            Verify
         </Button>

         <p className="flex flex-wrap justify-center gap-x-3 text-center text-sm text-viewertext">
            <ResendLink
               onResend={onResend}
               onError={setError}
               onSent={() => {
                  setError(null);
                  setCode("");
               }}
               disabled={verifying}
            />
            {secondary}
         </p>
      </form>
   );
};

export default CodeStep;
