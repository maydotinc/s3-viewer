import FieldMessage from "@/components/Auth/field-message";
import GithubIcon from "@/components/Auth/github-icon";
import PasswordInput from "@/components/Auth/password-input";
import { TEXT_LINK } from "@/components/Auth/text-link";
import { continueWithPassword, requestSignInCode } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import {
   PASSWORD_MIN_LENGTH,
   SITE_PATHS,
   emailSchema,
   passwordSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type Mode = "login" | "signup";

type SignInFormProps = {
   mode: Mode;
   initialEmail: string;
   notice: string | null;
   githubError: string | null;
   onGithub: () => void;
   onCodeSent: (email: string) => void;
   onSignedIn: () => Promise<void>;
   onSignedUp: (email: string) => Promise<void>;
};

const { emailLoginEnabled, passwordLoginEnabled, githubLoginEnabled } =
   publicEnv;

// the two pages run the same flow (a password signs in or creates the
// account); only their words differ
const SUBMIT_LABEL: Record<Mode, string> = {
   login: "Sign in",
   signup: "Create account",
};

const Divider = () => (
   <div className="text-meta flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-viewerborder" />
      or
      <span className="h-px flex-1 bg-viewerborder" />
   </div>
);

const SignInForm = ({
   mode,
   initialEmail,
   notice,
   githubError,
   onGithub,
   onCodeSent,
   onSignedIn,
   onSignedUp,
}: SignInFormProps) => {
   const [email, setEmail] = useState(initialEmail);
   const [password, setPassword] = useState("");
   const [emailError, setEmailError] = useState<string | null>(null);
   const [passwordError, setPasswordError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);

   const validEmail = (): string | null => {
      const parsed = emailSchema.safeParse(email);
      if (parsed.success) return parsed.data;
      setEmailError("Enter a valid email address.");
      return null;
   };

   const sendCode = async () => {
      const address = validEmail();
      if (!address) return;
      setPending(true);
      const { error } = await requestSignInCode(address);
      if (error) {
         setEmailError(error);
         setPending(false);
         return;
      }
      onCodeSent(address);
   };

   const submitPassword = async () => {
      const address = validEmail();
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) {
         setPasswordError(
            password
               ? (parsed.error.issues[0]?.message ?? "")
               : "Enter your password."
         );
      }
      if (!address || !parsed.success) return;
      setPending(true);
      const result = await continueWithPassword(address, parsed.data);
      if (result.error) {
         setPasswordError(result.error);
         setPending(false);
         return;
      }
      if (result.created) await onSignedUp(address);
      else await onSignedIn();
   };

   const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;
      void (passwordLoginEnabled ? submitPassword() : sendCode());
   };

   if (!emailLoginEnabled && !passwordLoginEnabled && !githubLoginEnabled) {
      return (
         <p
            role="status"
            className="rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext"
         >
            No sign-in method is configured for this deployment.
         </p>
      );
   }

   const codeLink = passwordLoginEnabled && emailLoginEnabled && (
      <button
         type="button"
         disabled={pending}
         onClick={() => void sendCode()}
         className={TEXT_LINK}
      >
         Email me a code instead
      </button>
   );
   const resetLink = passwordLoginEnabled && emailLoginEnabled && (
      <Link href={SITE_PATHS.forgotPassword} className={TEXT_LINK}>
         Forgot password?
      </Link>
   );

   return (
      <div className="flex flex-col gap-6">
         {notice && (
            <p
               role="status"
               className="rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext"
            >
               {notice}
            </p>
         )}

         {githubLoginEnabled && (
            <>
               <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={onGithub}
               >
                  <GithubIcon className="size-4" />
                  Continue with GitHub
               </Button>
               {githubError && (
                  <p role="alert" className="text-sm text-viewertextred">
                     {githubError}
                  </p>
               )}
               {(emailLoginEnabled || passwordLoginEnabled) && <Divider />}
            </>
         )}

         {(emailLoginEnabled || passwordLoginEnabled) && (
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
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

               {passwordLoginEnabled && (
                  <div className="flex flex-col gap-1.5">
                     <Label htmlFor="password">Password</Label>
                     <PasswordInput
                        id="password"
                        name="password"
                        autoComplete={
                           mode === "login"
                              ? "current-password"
                              : "new-password"
                        }
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
                        hint={
                           mode === "signup"
                              ? `At least ${PASSWORD_MIN_LENGTH} characters.`
                              : undefined
                        }
                     />
                  </div>
               )}

               <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  loading={pending}
               >
                  {passwordLoginEnabled ? SUBMIT_LABEL[mode] : "Continue"}
               </Button>

               {(resetLink || codeLink) && (
                  <p className="flex flex-wrap items-center justify-center gap-x-3 text-center text-sm text-viewertext">
                     {resetLink}
                     {resetLink && codeLink && (
                        <span
                           aria-hidden="true"
                           className="text-viewerlighttext"
                        >
                           ·
                        </span>
                     )}
                     {codeLink}
                  </p>
               )}
            </form>
         )}
      </div>
   );
};

export default SignInForm;
