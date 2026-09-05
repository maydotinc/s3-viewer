import { AuthLayout, StepHeader } from "@/components/Auth/auth-layout";
import EmailField from "@/components/Auth/email-field";
import { TEXT_LINK } from "@/components/Auth/text-link";
import { useStepHeight } from "@/components/Auth/use-step-height";
import FullPageSpinner from "@/components/Session/full-page-spinner";
import { requestPasswordReset } from "@/lib/auth";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { AUTH_LINK_TTL_HOURS, SITE_PATHS, emailSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Step = "email" | "sent";

const ForgotPasswordScreen = () => {
   const router = useRouter();
   const sessionState = useSessionState();
   const [step, setStep] = useState<Step>("email");
   const [email, setEmail] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);
   const redirected = useRef(false);
   const stepHeight = useStepHeight(step === "email");

   useEffect(() => {
      if (sessionState !== "signedIn" || redirected.current) return;
      redirected.current = true;
      void router.replace(SITE_PATHS.dashboard);
   }, [sessionState, router]);

   if (sessionState !== "signedOut") return <FullPageSpinner />;

   const send = async (address: string) => {
      setPending(true);
      const result = await requestPasswordReset(address);
      setPending(false);
      if (result.error) {
         setError(result.error);
         return false;
      }
      return true;
   };

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
         setError("Enter a valid email address.");
         return;
      }
      if (await send(parsed.data)) {
         setEmail(parsed.data);
         setStep("sent");
      }
   };

   return (
      <AuthLayout>
         <div key={step} ref={stepHeight.ref} style={stepHeight.style}>
            {step === "email" ? (
               <>
                  <StepHeader title="Reset your password">
                     Enter your email and we&apos;ll send you a link. If you
                     signed up with GitHub, this is also how you add a password.
                  </StepHeader>
                  <form
                     onSubmit={(event) => void submit(event)}
                     noValidate
                     className="mt-8 flex flex-col gap-4"
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
                     <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        loading={pending}
                     >
                        Send reset link
                     </Button>
                  </form>
               </>
            ) : (
               <>
                  <StepHeader title="Check your inbox">
                     If{" "}
                     <span className="font-medium text-viewerblack">
                        {email}
                     </span>{" "}
                     has an account, a reset link is on its way. It expires in{" "}
                     {AUTH_LINK_TTL_HOURS} hour.
                  </StepHeader>
                  {error && (
                     <p
                        role="alert"
                        className="mt-8 text-sm leading-5 text-viewertextred"
                     >
                        {error}
                     </p>
                  )}
                  <p className="mt-8 text-sm text-viewertext">
                     Didn&apos;t get it?{" "}
                     <button
                        type="button"
                        disabled={pending}
                        onClick={() => void send(email)}
                        className={TEXT_LINK}
                     >
                        Send again
                     </button>{" "}
                     or{" "}
                     <button
                        type="button"
                        onClick={() => setStep("email")}
                        className={TEXT_LINK}
                     >
                        use another email
                     </button>
                     .
                  </p>
               </>
            )}
         </div>
      </AuthLayout>
   );
};

export default ForgotPasswordScreen;
