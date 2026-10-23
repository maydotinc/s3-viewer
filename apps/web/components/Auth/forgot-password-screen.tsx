import { AuthLayout, StepHeader } from "./auth-layout";
import EmailField from "./email-field";
import StatusLine from "./status-line";
import { TEXT_LINK } from "./text-link";
import { requestPasswordReset } from "@/lib/auth";
import { INVALID_EMAIL_MESSAGE } from "@s3-viewer/auth/client";
import { pluralize } from "@/lib/utils/format";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { AUTH_LINK_TTL_HOURS, emailSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";

import { useState, type FormEvent } from "react";

type Step = "email" | "sent";

const ForgotPasswordScreen = () => {
   const config = useInstanceConfig();
   const transport = emailState(config);
   const [step, setStep] = useState<Step>("email");
   const [email, setEmail] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);
   const [resent, setResent] = useState(false);

   // the form renders at once; an instance without email swaps to this once the config says so
   if (transport === "disabled") {
      return (
         <AuthLayout>
            <StepHeader title="Password reset is unavailable">
               This instance has no email configured, so a reset link can&apos;t
               be sent. Ask whoever runs it to set up email or to reset your
               password for you.
            </StepHeader>
         </AuthLayout>
      );
   }

   const send = async (address: string) => {
      setPending(true);
      const result = await requestPasswordReset(address);
      setPending(false);
      setError(result.error ?? null);
      return !result.error;
   };

   const resend = async () => {
      setResent(false);
      setResent(await send(email));
   };

   const changeEmail = () => {
      setError(null);
      setResent(false);
      setStep("email");
   };

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
         setError(INVALID_EMAIL_MESSAGE);
         return;
      }
      if (await send(parsed.data)) {
         setEmail(parsed.data);
         setStep("sent");
      }
   };

   return (
      <AuthLayout>
         {step === "email" ? (
            <div key={step} className="flex flex-col gap-6">
               <StepHeader title="Reset your password">
                  Enter your email and we&apos;ll send you a reset link.
               </StepHeader>
               <form
                  onSubmit={(event) => void submit(event)}
                  noValidate
                  className="flex flex-col gap-5"
               >
                  <EmailField
                     value={email}
                     error={error}
                     disabled={pending}
                     onChange={(next) => {
                        setEmail(next);
                        if (error) setError(null);
                     }}
                  />
                  <Button type="submit" className="w-full" loading={pending}>
                     Send reset link
                  </Button>
               </form>
            </div>
         ) : (
            <div key={step} className="animate-fade-in flex flex-col gap-6">
               <StepHeader title="Check your inbox">
                  If{" "}
                  <span className="font-medium text-viewerblack">{email}</span>{" "}
                  has an account, a reset link is on its way. It expires in{" "}
                  {pluralize(AUTH_LINK_TTL_HOURS, "hour")}.
               </StepHeader>
               <div className="flex flex-col gap-2 text-center text-sm text-viewertext">
                  <p>
                     Didn&apos;t get it?{" "}
                     <button
                        type="button"
                        disabled={pending}
                        onClick={() => void resend()}
                        className={TEXT_LINK}
                     >
                        Send again
                     </button>{" "}
                     or{" "}
                     <button
                        type="button"
                        onClick={changeEmail}
                        className={TEXT_LINK}
                     >
                        use another email
                     </button>
                     .
                  </p>
                  <StatusLine
                     error={error}
                     status={resent ? "Sent again." : null}
                  />
               </div>
            </div>
         )}
      </AuthLayout>
   );
};

export default ForgotPasswordScreen;
