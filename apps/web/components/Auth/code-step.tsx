import OtpInput from "@/components/Auth/otp-input";
import { errorMessage } from "@/lib/api";
import { startAuthFlow, verifyOtp } from "@/lib/auth";
import { AUTH_CODE_LENGTH } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { useEffect, useRef, useState, type FormEvent } from "react";

const RESEND_SECONDS = 45;

type CodeStepProps = {
   email: string;
   onVerified: () => Promise<void>;
};

const CodeStep = ({ email, onVerified }: CodeStepProps) => {
   const [code, setCode] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [verifying, setVerifying] = useState(false);
   const [resending, setResending] = useState(false);
   const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
   const inFlight = useRef(false);

   useEffect(() => {
      if (secondsLeft <= 0) return;
      const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
      return () => clearTimeout(timer);
   }, [secondsLeft]);

   const verify = async (value: string) => {
      if (inFlight.current || value.length !== AUTH_CODE_LENGTH) return;
      inFlight.current = true;
      setVerifying(true);
      setError(null);
      const { error: verifyError } = await verifyOtp(email, value);
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

   const resend = async () => {
      if (secondsLeft > 0 || resending || verifying) return;
      setResending(true);
      setError(null);
      setCode("");
      try {
         await startAuthFlow(email);
         setSecondsLeft(RESEND_SECONDS);
      } catch (caught) {
         setError(errorMessage(caught));
      } finally {
         setResending(false);
      }
   };

   const canResend = secondsLeft <= 0 && !resending && !verifying;

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

         <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={verifying}
            disabled={resending}
         >
            {verifying ? "Verifying…" : "Verify"}
         </Button>

         <p className="text-center text-sm text-viewertext">
            Didn&apos;t get it?{" "}
            <button
               type="button"
               onClick={resend}
               disabled={!canResend}
               className="rounded-sm font-medium text-viewerblue underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-viewerblue/40 disabled:cursor-default disabled:text-viewerlighttext disabled:no-underline"
            >
               {resending
                  ? "Sending…"
                  : secondsLeft > 0
                    ? `Resend code in ${secondsLeft}s`
                    : "Resend code"}
            </button>
         </p>
      </form>
   );
};

export default CodeStep;
