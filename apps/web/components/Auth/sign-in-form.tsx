import Callout from "@/components/callout";
import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import EmailField from "./email-field";
import GithubIcon from "./github-icon";
import PasswordInput from "./password-input";
import { signUpHint } from "./sign-up-policy";
import { TEXT_LINK } from "./text-link";
import { continueWithPassword } from "@/lib/auth";
import { AuthErrorCode, INVALID_EMAIL_MESSAGE } from "@s3-viewer/auth/client";
import useInstanceConfig, {
   githubEnabled,
   signUpPolicyState,
} from "@/lib/hooks/queries/useInstanceConfig";
import {
   PASSWORD_MIN_LENGTH,
   SITE_PATHS,
   emailSchema,
   passwordSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Mode = "login" | "signup";

type Credentials = { email: string; password: string };

// `verificationRequired` means no session exists yet: the code step comes next
type Outcome = Credentials & {
   created: boolean;
   verificationRequired: boolean;
};

type SignInFormProps = {
   mode: Mode;
   notice: string | null;
   inviteId?: string | undefined;
   initialEmail?: string;
   focusPassword?: boolean;
   githubPending?: boolean;
   onGithub: () => void;
   onDone: (outcome: Outcome) => Promise<void>;
};

const SUBMIT_LABEL: Record<Mode, string> = {
   login: "Log in",
   signup: "Create account",
};

const POLICY_CODES = new Set([
   AuthErrorCode.SIGNUP_DISABLED,
   AuthErrorCode.SIGNUP_INVITE_REQUIRED,
   "EMAIL_PASSWORD_SIGN_UP_DISABLED",
]);

const Divider = () => (
   <div className="flex select-none items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-viewerborder" />
      <span className="text-meta uppercase tracking-wide">or</span>
      <span className="h-px flex-1 bg-viewerborder" />
   </div>
);

const SignInForm = ({
   mode,
   notice,
   inviteId,
   initialEmail = "",
   focusPassword = false,
   githubPending = false,
   onGithub,
   onDone,
}: SignInFormProps) => {
   const [email, setEmail] = useState(initialEmail);
   const [password, setPassword] = useState("");
   const [emailError, setEmailError] = useState<string | null>(null);
   const [passwordError, setPasswordError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);
   // a sign-up that hits an existing account offers the reset that reclaims it,
   // including one a stranger registered and never verified
   const [offerReset, setOfferReset] = useState(false);
   const passwordRef = useRef<HTMLInputElement>(null);
   const { data: config } = useInstanceConfig();
   const { mode: signUp, domains } = signUpPolicyState(config);

   // a remembered address arrives after mount; never overwrite what the person typed
   useEffect(() => {
      if (initialEmail) setEmail((current) => current || initialEmail);
   }, [initialEmail]);

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending || githubPending) return;
      const address = emailSchema.safeParse(email);
      const parsed = passwordSchema.safeParse(password);
      if (!address.success) setEmailError(INVALID_EMAIL_MESSAGE);
      if (!parsed.success) {
         setPasswordError(
            password
               ? (parsed.error.issues[0]?.message ?? "")
               : "Enter your password."
         );
      }
      if (!address.success || !parsed.success) return;
      // a typo on the login page must not create an account and mail a stranger;
      // invitation links land on /login, so they still create the invited account.
      const allowSignUp =
         signUp !== "closed" && (mode === "signup" || inviteId !== undefined);
      setPending(true);
      setOfferReset(false);
      const result = await continueWithPassword(address.data, parsed.data, {
         allowSignUp,
         inviteId,
      });
      const credentials = { email: address.data, password: parsed.data };
      if (result.code === AuthErrorCode.EMAIL_NOT_VERIFIED) {
         await onDone({
            ...credentials,
            created: false,
            verificationRequired: true,
         });
         return;
      }
      if (result.error) {
         if (result.code && POLICY_CODES.has(result.code)) {
            setEmailError(result.error);
         } else setPasswordError(result.error);
         setOfferReset(result.exists === true);
         setPending(false);
         return;
      }
      await onDone({
         ...credentials,
         created: result.created,
         verificationRequired: result.created,
      });
   };

   return (
      <div className="flex flex-col gap-6">
         {notice && (
            <Callout role="status">
               <p>{notice}</p>
            </Callout>
         )}

         <form
            onSubmit={(event) => void submit(event)}
            noValidate
            className="flex flex-col gap-5"
         >
            <fieldset
               disabled={githubPending}
               className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0"
            >
               <EmailField
                  value={email}
                  error={emailError}
                  hint={signUpHint(signUp, domains)}
                  disabled={pending}
                  autoFocus={!focusPassword}
                  onChange={(next) => {
                     setEmail(next);
                     if (emailError) setEmailError(null);
                     setOfferReset(false);
                  }}
                  onEnter={() => passwordRef.current?.focus()}
               />
               <Field
                  label="Password"
                  htmlFor="password"
                  trailing={
                     (mode === "login" || offerReset) && (
                        <Link
                           href={SITE_PATHS.forgotPassword}
                           className={`${TEXT_LINK} text-sm`}
                        >
                           Forgot password?
                        </Link>
                     )
                  }
               >
                  <PasswordInput
                     ref={passwordRef}
                     id="password"
                     name="password"
                     autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                     }
                     autoFocus={focusPassword}
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
                  <FormError
                     id="password-message"
                     size="sm"
                     reserve={false}
                     hint={
                        mode === "signup"
                           ? `At least ${PASSWORD_MIN_LENGTH} characters.`
                           : undefined
                     }
                  >
                     {passwordError}
                  </FormError>
               </Field>
            </fieldset>

            <div className="flex flex-col gap-4">
               <Button
                  type="submit"
                  className="w-full"
                  loading={pending}
                  disabled={githubPending}
               >
                  {SUBMIT_LABEL[mode]}
               </Button>
               {githubEnabled(config) && (
                  <>
                     <Divider />
                     <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="w-full"
                        loading={githubPending}
                        disabled={pending}
                        onClick={onGithub}
                     >
                        <GithubIcon className="size-5" />
                        Continue with GitHub
                     </Button>
                  </>
               )}
            </div>
         </form>
      </div>
   );
};

export default SignInForm;
export type { Mode, Outcome };
