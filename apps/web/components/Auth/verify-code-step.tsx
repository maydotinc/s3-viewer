import Field from "@/components/form-field";
import { StepHeader } from "./auth-layout";
import { TEXT_LINK } from "./text-link";
import { sendVerificationCode, verifyEmailCode } from "@/lib/auth";
import { AuthErrorCode } from "@s3-viewer/auth/client";
import {
   GENERIC_ERROR_MESSAGE,
   SITE_PATHS,
   VERIFICATION_CODE_LENGTH,
   VERIFICATION_CODE_RESEND_SECONDS,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { cn } from "@s3-viewer/ui/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

type VerifyCodeStepProps = {
   email: string;
   password: string;
   // development without an email transport: the API log prints the code
   codeInLog: boolean;
   backLabel: string;
   onBack: (notice?: string) => void;
   onVerified: () => Promise<void>;
};

const PASSWORD_CHANGED = "Your password changed. Log in again to continue.";
const INCOMPLETE = `Enter the ${VERIFICATION_CODE_LENGTH}-digit code.`;

const digitsOnly = (value: string) =>
   value.replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH);

const resendDeadline = () =>
   Date.now() + VERIFICATION_CODE_RESEND_SECONDS * 1000;

// counts down to a deadline once a second; null once it has passed
const useCountdown = (deadline: number): number | null => {
   const [left, setLeft] = useState(() =>
      Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
   );
   useEffect(() => {
      const remaining = () =>
         Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining());
      const timer = setInterval(() => {
         const next = remaining();
         setLeft(next);
         if (next === 0) clearInterval(timer);
      }, 1000);
      return () => clearInterval(timer);
   }, [deadline]);
   return left > 0 ? left : null;
};

const VerifyCodeStep = ({
   email,
   password,
   codeInLog,
   backLabel,
   onBack,
   onVerified,
}: VerifyCodeStepProps) => {
   const [code, setCode] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [status, setStatus] = useState<string | null>(null);
   const [pending, setPending] = useState(false);
   const [resending, setResending] = useState(false);
   // the per-address guess budget is spent, so a fresh code would be refused too
   const [locked, setLocked] = useState(false);
   // the code was mailed by the sign-up or sign-in that led here
   const [deadline, setDeadline] = useState(resendDeadline);
   const secondsLeft = useCountdown(deadline);
   const inputRef = useRef<HTMLInputElement>(null);

   const verify = async (value: string) => {
      if (pending) return;
      if (value.length !== VERIFICATION_CODE_LENGTH) {
         setError(INCOMPLETE);
         return;
      }
      setPending(true);
      setError(null);
      setStatus(null);
      const result = await verifyEmailCode(email, value, password);
      if (!result.error) {
         try {
            await onVerified();
            return;
         } catch {
            setPending(false);
            setError(GENERIC_ERROR_MESSAGE);
            return;
         }
      }
      setPending(false);
      if (result.code === AuthErrorCode.INVALID_EMAIL_OR_PASSWORD) {
         onBack(PASSWORD_CHANGED);
         return;
      }
      if (result.code === AuthErrorCode.VERIFICATION_LOCKED) setLocked(true);
      setError(result.error);
      inputRef.current?.select();
   };

   const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void verify(code);
   };

   const change = (value: string) => {
      const next = digitsOnly(value);
      setCode(next);
      if (error) setError(null);
      if (next.length === VERIFICATION_CODE_LENGTH) void verify(next);
   };

   const resend = async () => {
      if (resending || secondsLeft !== null) return;
      setResending(true);
      setError(null);
      setStatus(null);
      const result = await sendVerificationCode(email);
      setResending(false);
      if (result.error) {
         setError(result.error);
         return;
      }
      setDeadline(resendDeadline());
      setStatus(codeInLog ? "Code sent to the API log." : "Code sent.");
      setCode("");
      inputRef.current?.focus();
   };

   return (
      <>
         <StepHeader title="Check your email">
            Enter the {VERIFICATION_CODE_LENGTH}-digit code we sent to{" "}
            <span className="font-medium text-viewerblack">{email}</span>.
         </StepHeader>
         <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <Field label="Verification code" htmlFor="verification-code">
               <Input
                  ref={inputRef}
                  id="verification-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={VERIFICATION_CODE_LENGTH}
                  autoFocus
                  required
                  placeholder="······"
                  value={code}
                  // read-only rather than disabled: a disabled field loses focus, and the
                  // wrong-code path needs it selected for the next attempt
                  readOnly={pending}
                  aria-busy={pending || undefined}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="verification-code-message"
                  onChange={(event) => change(event.target.value)}
                  className="h-12 text-center font-mono text-2xl tracking-[0.5em] tabular-nums placeholder:tracking-[0.5em] sm:text-2xl"
               />
               {codeInLog && (
                  <p className="text-xs leading-5 text-viewertext">
                     Email is off on this instance, so the code is printed in
                     the API log instead.
                  </p>
               )}
            </Field>
            <Button type="submit" className="w-full" loading={pending}>
               Verify
            </Button>
         </form>
         <div className="flex flex-col gap-2 text-center text-sm text-viewertext">
            {locked ? (
               <p>
                  <Link href={SITE_PATHS.forgotPassword} className={TEXT_LINK}>
                     Reset password
                  </Link>
               </p>
            ) : (
               <p>
                  Didn&apos;t get it?{" "}
                  <button
                     type="button"
                     disabled={pending || resending || secondsLeft !== null}
                     onClick={() => void resend()}
                     className={`${TEXT_LINK} tabular-nums`}
                  >
                     {secondsLeft === null
                        ? "Resend code"
                        : `Resend code in ${secondsLeft}s`}
                  </button>
               </p>
            )}
            <p>
               <button
                  type="button"
                  disabled={pending}
                  onClick={() => onBack()}
                  className={TEXT_LINK}
               >
                  {backLabel}
               </button>
            </p>
            <p
               id="verification-code-message"
               role={error ? "alert" : "status"}
               className={cn(
                  "min-h-5 break-words leading-5",
                  error ? "text-viewertextred" : "text-viewertext"
               )}
            >
               {error ?? status ?? ""}
            </p>
         </div>
      </>
   );
};

export default VerifyCodeStep;
