import EmailField from "@/components/Auth/email-field";
import FieldMessage from "@/components/Auth/field-message";
import GithubIcon from "@/components/Auth/github-icon";
import PasswordInput from "@/components/Auth/password-input";
import { TEXT_LINK } from "@/components/Auth/text-link";
import { continueWithPassword } from "@/lib/auth";
import useInstanceConfig, {
   githubEnabled,
} from "@/lib/hooks/queries/useInstanceConfig";
import {
   PASSWORD_MIN_LENGTH,
   SITE_PATHS,
   emailSchema,
   passwordSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Label } from "@s3-viewer/ui/components/label";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type Mode = "login" | "signup";

type SignInFormProps = {
   mode: Mode;
   notice: string | null;
   onGithub: () => void;
   onDone: (created: boolean) => Promise<void>;
};

// the two pages run the same flow (a password signs in or creates the
// account); only their words differ
const SUBMIT_LABEL: Record<Mode, string> = {
   login: "Log in",
   signup: "Create account",
};

const SignInForm = ({ mode, notice, onGithub, onDone }: SignInFormProps) => {
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [emailError, setEmailError] = useState<string | null>(null);
   const [passwordError, setPasswordError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);
   const { data: config } = useInstanceConfig();

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;
      const address = emailSchema.safeParse(email);
      const parsed = passwordSchema.safeParse(password);
      if (!address.success) setEmailError("Enter a valid email address.");
      if (!parsed.success) {
         setPasswordError(
            password
               ? (parsed.error.issues[0]?.message ?? "")
               : "Enter your password."
         );
      }
      if (!address.success || !parsed.success) return;
      setPending(true);
      const result = await continueWithPassword(address.data, parsed.data);
      if (result.error) {
         setPasswordError(result.error);
         setPending(false);
         return;
      }
      await onDone(result.created);
   };

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

         {githubEnabled(config) && (
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
               <div
                  className="text-meta flex items-center gap-3"
                  aria-hidden="true"
               >
                  <span className="h-px flex-1 bg-viewerborder" />
                  or
                  <span className="h-px flex-1 bg-viewerborder" />
               </div>
            </>
         )}

         <form
            onSubmit={(event) => void submit(event)}
            noValidate
            className="flex flex-col gap-4"
         >
            <EmailField
               value={email}
               error={emailError}
               disabled={pending}
               onChange={(next) => {
                  setEmail(next);
                  if (emailError) setEmailError(null);
               }}
            />
            <div className="flex flex-col gap-1.5">
               <Label htmlFor="password">Password</Label>
               <PasswordInput
                  id="password"
                  name="password"
                  autoComplete={
                     mode === "login" ? "current-password" : "new-password"
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
                  reserve
               />
            </div>
            <Button
               type="submit"
               size="lg"
               className="w-full"
               loading={pending}
            >
               {SUBMIT_LABEL[mode]}
            </Button>
            <p className="text-center text-sm text-viewertext">
               <Link href={SITE_PATHS.forgotPassword} className={TEXT_LINK}>
                  Forgot password?
               </Link>
            </p>
         </form>
      </div>
   );
};

export default SignInForm;
