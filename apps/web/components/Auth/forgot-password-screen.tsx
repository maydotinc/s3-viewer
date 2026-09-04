import { AuthLayout, StepHeader } from "@/components/Auth/auth-layout";
import FieldMessage from "@/components/Auth/field-message";
import OtpInput from "@/components/Auth/otp-input";
import PasswordInput from "@/components/Auth/password-input";
import ResendLink from "@/components/Auth/resend-link";
import { TEXT_LINK } from "@/components/Auth/text-link";
import { useStepHeight } from "@/components/Auth/use-step-height";
import FullPageSpinner from "@/components/Session/full-page-spinner";
import {
   requestPasswordReset,
   resetPassword,
   signInWithPassword,
} from "@/lib/auth";
import { useSessionState } from "@/lib/hooks/useSessionState";
import {
   AUTH_CODE_LENGTH,
   PASSWORD_MIN_LENGTH,
   SITE_PATHS,
   emailSchema,
   passwordSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Step = "email" | "reset";

const ForgotPasswordScreen = () => {
   const router = useRouter();
   const sessionState = useSessionState();
   const [step, setStep] = useState<Step>("email");
   const [email, setEmail] = useState("");
   const [code, setCode] = useState("");
   const [password, setPassword] = useState("");
   const [emailError, setEmailError] = useState<string | null>(null);
   const [codeError, setCodeError] = useState<string | null>(null);
   const [passwordError, setPasswordError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);
   const redirected = useRef(false);
   const stepHeight = useStepHeight(step === "email");

   useEffect(() => {
      if (sessionState !== "signedIn" || redirected.current) return;
      redirected.current = true;
      void router.replace(SITE_PATHS.dashboard);
   }, [sessionState, router]);

   if (sessionState !== "signedOut") return <FullPageSpinner />;

   const sendCode = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
         setEmailError("Enter a valid email address.");
         return;
      }
      setPending(true);
      const { error } = await requestPasswordReset(parsed.data);
      setPending(false);
      if (error) {
         setEmailError(error);
         return;
      }
      setEmail(parsed.data);
      setStep("reset");
   };

   const reset = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = passwordSchema.safeParse(password);
      if (code.length !== AUTH_CODE_LENGTH) {
         setCodeError(
            `Enter the ${AUTH_CODE_LENGTH}-digit code from your email.`
         );
      }
      if (!parsed.success) {
         setPasswordError(
            parsed.error.issues[0]?.message ?? "Enter a password."
         );
      }
      if (code.length !== AUTH_CODE_LENGTH || !parsed.success) return;
      setPending(true);
      const { error } = await resetPassword(email, code, parsed.data);
      if (error) {
         // the code line is the one both a wrong code and a rejected password
         // point at; a wrong code also clears itself for a fresh attempt
         setCodeError(error);
         setCode("");
         setPending(false);
         return;
      }
      // the reset signs no one in; sign in with the password just chosen
      const signedIn = await signInWithPassword(email, parsed.data);
      if (signedIn.error) {
         setPending(false);
         await router.replace(SITE_PATHS.login);
         return;
      }
      redirected.current = true;
      await router.replace(SITE_PATHS.dashboard);
   };

   return (
      <AuthLayout>
         <div key={step} ref={stepHeight.ref} style={stepHeight.style}>
            {step === "email" ? (
               <>
                  <StepHeader title="Reset your password">
                     Enter your email and we&apos;ll send you a code. If you
                     signed up without a password, this is also how you add one.
                  </StepHeader>
                  <form
                     onSubmit={sendCode}
                     noValidate
                     className="mt-8 flex flex-col gap-4"
                  >
                     <div className="flex flex-col gap-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                           id="email"
                           name="email"
                           type="email"
                           inputMode="email"
                           autoComplete="email"
                           autoFocus
                           required
                           placeholder="you@example.com"
                           value={email}
                           disabled={pending}
                           aria-invalid={emailError ? true : undefined}
                           aria-describedby="email-message"
                           onChange={(event) => {
                              setEmail(event.target.value);
                              if (emailError) setEmailError(null);
                           }}
                        />
                        <FieldMessage id="email-message" error={emailError} />
                     </div>
                     <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        loading={pending}
                     >
                        Send code
                     </Button>
                  </form>
                  <p className="mt-8 text-sm text-viewertext">
                     Remembered it?{" "}
                     <Link href={SITE_PATHS.login} className={TEXT_LINK}>
                        Sign in
                     </Link>
                  </p>
               </>
            ) : (
               <>
                  <StepHeader title="Check your inbox">
                     We sent a code to{" "}
                     <span className="font-medium text-viewerblack">
                        {email}
                     </span>
                     .{" "}
                     <button
                        type="button"
                        onClick={() => setStep("email")}
                        className={TEXT_LINK}
                     >
                        Edit
                     </button>
                  </StepHeader>
                  <form
                     onSubmit={reset}
                     noValidate
                     className="mt-8 flex flex-col gap-4"
                  >
                     <div className="flex flex-col gap-1.5">
                        <Label asChild>
                           <span>Code</span>
                        </Label>
                        <OtpInput
                           value={code}
                           onChange={(next) => {
                              setCode(next);
                              if (codeError) setCodeError(null);
                           }}
                           onComplete={() => undefined}
                           disabled={pending}
                           invalid={Boolean(codeError)}
                        />
                        <FieldMessage id="code-message" error={codeError} />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <Label htmlFor="new-password">New password</Label>
                        <PasswordInput
                           id="new-password"
                           name="new-password"
                           autoComplete="new-password"
                           required
                           value={password}
                           disabled={pending}
                           aria-invalid={passwordError ? true : undefined}
                           aria-describedby="password-message"
                           onChange={(event) => {
                              setPassword(event.target.value);
                              if (passwordError) setPasswordError(null);
                           }}
                        />
                        <FieldMessage
                           id="password-message"
                           error={passwordError}
                           hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
                        />
                     </div>
                     <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        loading={pending}
                     >
                        Reset password
                     </Button>
                     <p className="text-center text-sm text-viewertext">
                        <ResendLink
                           onResend={() => requestPasswordReset(email)}
                           onError={setCodeError}
                           onSent={() => setCode("")}
                           disabled={pending}
                        />
                     </p>
                  </form>
               </>
            )}
         </div>
      </AuthLayout>
   );
};

export default ForgotPasswordScreen;
