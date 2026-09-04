import FieldMessage from "@/components/Auth/field-message";
import GithubIcon from "@/components/Auth/github-icon";
import PasswordInput from "@/components/Auth/password-input";
import { TEXT_LINK } from "@/components/Auth/text-link";
import {
   requestSignInCode,
   signInWithPassword,
   signUpWithPassword,
   type AuthResult,
} from "@/lib/auth";
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
type Pending = "password" | "code" | null;

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
   const [pending, setPending] = useState<Pending>(null);
   const busy = pending !== null;

   const validEmail = (): string | null => {
      const parsed = emailSchema.safeParse(email);
      if (parsed.success) return parsed.data;
      setEmailError("Enter a valid email address.");
      return null;
   };

   const sendCode = async () => {
      const address = validEmail();
      if (!address) return;
      setPending("code");
      const { error } = await requestSignInCode(address);
      if (error) {
         setEmailError(error);
         setPending(null);
         return;
      }
      onCodeSent(address);
   };

   const submitPassword = async () => {
      const address = validEmail();
      const parsed = passwordSchema.safeParse(password);
      if (mode === "signup" && !parsed.success) {
         setPasswordError(
            parsed.error.issues[0]?.message ?? "Enter a password."
         );
      } else if (!password) {
         setPasswordError("Enter your password.");
      }
      if (!address || !password || (mode === "signup" && !parsed.success)) {
         return;
      }
      setPending("password");
      const result: AuthResult =
         mode === "login"
            ? await signInWithPassword(address, password)
            : await signUpWithPassword(address, password);
      if (result.error) {
         setPasswordError(result.error);
         setPending(null);
         return;
      }
      if (mode === "login") await onSignedIn();
      else await onSignedUp(address);
   };

   const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy) return;
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
                  disabled={busy}
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
                     disabled={busy}
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
                     <div className="flex h-4 items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {mode === "login" && emailLoginEnabled && (
                           <Link
                              href={SITE_PATHS.forgotPassword}
                              className={`${TEXT_LINK} text-sm leading-none`}
                           >
                              Forgot password?
                           </Link>
                        )}
                     </div>
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
                        disabled={busy}
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
                  loading={
                     pending === (passwordLoginEnabled ? "password" : "code")
                  }
                  disabled={
                     busy &&
                     pending !== (passwordLoginEnabled ? "password" : "code")
                  }
               >
                  {passwordLoginEnabled ? SUBMIT_LABEL[mode] : "Continue"}
               </Button>

               {passwordLoginEnabled && emailLoginEnabled && (
                  <Button
                     type="button"
                     variant="outline"
                     size="lg"
                     className="w-full"
                     loading={pending === "code"}
                     disabled={pending === "password"}
                     onClick={() => void sendCode()}
                  >
                     Email me a code instead
                  </Button>
               )}
            </form>
         )}
      </div>
   );
};

export default SignInForm;
