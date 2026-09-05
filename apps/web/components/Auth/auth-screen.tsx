import { AuthLayout, StepHeader } from "@/components/Auth/auth-layout";
import CodeStep from "@/components/Auth/code-step";
import SignInForm from "@/components/Auth/sign-in-form";
import { TEXT_LINK } from "@/components/Auth/text-link";
import { useStepHeight } from "@/components/Auth/use-step-height";
import FullPageSpinner from "@/components/Session/full-page-spinner";
import {
   requestSignInCode,
   sendVerificationCode,
   signInWithGithub,
   verifyEmail,
   verifyOtp,
} from "@/lib/auth";
import { afterLoginPath, reasonForError } from "@/lib/auth-redirect";
import { publicEnv } from "@/lib/env";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { SITE_PATHS } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

type Mode = "login" | "signup";
type Step = "form" | "code" | "verify";

type AuthScreenProps = {
   mode: Mode;
   initialEmail?: string;
};

const { emailLoginEnabled, passwordLoginEnabled, githubLoginEnabled } =
   publicEnv;

// both pages run one flow: a password signs in or, for a new address,
// creates the account; a code does the same
const subtitle = (mode: Mode): string => {
   if (passwordLoginEnabled && emailLoginEnabled) {
      return mode === "login"
         ? "Use your password, or a one-time code by email."
         : "Pick a password, or use a one-time code by email.";
   }
   if (passwordLoginEnabled) {
      return mode === "login"
         ? "Enter your email and password."
         : "Enter your email and pick a password.";
   }
   if (emailLoginEnabled) {
      return "Enter your email and we'll send you a code and a sign-in link.";
   }
   if (githubLoginEnabled) return "Continue with your GitHub account.";
   return "";
};

const COPY = {
   login: {
      title: "Welcome back",
      switchPrompt: "Don't have an account?",
      switchLabel: "Create one",
      switchHref: SITE_PATHS.signup,
   },
   signup: {
      title: "Create your account",
      switchPrompt: "Already have an account?",
      switchLabel: "Sign in",
      switchHref: SITE_PATHS.login,
   },
} as const;

const NOTICES: Readonly<Record<string, string>> = {
   link: "That sign-in link has expired. Enter your email to get a new one.",
   failed: "Sign-in didn't complete. Try again, or use the code we email you.",
};

const Email = ({ children }: { children: string }) => (
   <span className="font-medium text-viewerblack">{children}</span>
);

const AuthScreen = ({ mode, initialEmail }: AuthScreenProps) => {
   const router = useRouter();
   const sessionState = useSessionState();
   const [email, setEmail] = useState(initialEmail ?? "");
   const [step, setStep] = useState<Step>(initialEmail ? "code" : "form");
   const [leavingForGithub, setLeavingForGithub] = useState(false);
   const [githubError, setGithubError] = useState<string | null>(null);
   const redirected = useRef(false);
   const stepHeight = useStepHeight(step === "form");

   const destination = afterLoginPath(router.query.next);
   const copy = COPY[mode];
   // `error` is what better auth appends when an oauth or magic-link callback
   // fails and redirects here
   const callbackError =
      typeof router.query.error === "string" ? router.query.error : "";
   const reason =
      typeof router.query.reason === "string"
         ? router.query.reason
         : callbackError
           ? reasonForError(callbackError)
           : "";
   // own-property only: ?reason=toString would otherwise hand a prototype
   // function to react as a child.
   const notice = Object.hasOwn(NOTICES, reason)
      ? (NOTICES[reason] ?? null)
      : null;

   // a fresh password sign-up is signed in already but stays here to verify
   const verifying = step === "verify";

   const finish = async () => {
      redirected.current = true;
      await router.replace(destination);
   };

   useEffect(() => {
      if (sessionState !== "signedIn" || redirected.current || verifying) {
         return;
      }
      redirected.current = true;
      void router.replace(destination);
   }, [sessionState, destination, router, verifying]);

   const github = async () => {
      setGithubError(null);
      setLeavingForGithub(true);
      const { error } = await signInWithGithub();
      if (error) {
         setGithubError(error);
         setLeavingForGithub(false);
      }
   };

   if (
      sessionState === "pending" ||
      (sessionState === "signedIn" && !verifying)
   ) {
      return <FullPageSpinner />;
   }

   const switchHref = {
      pathname: copy.switchHref,
      query:
         destination === SITE_PATHS.dashboard
            ? undefined
            : { next: destination },
   };

   const steps: Record<Step, () => React.ReactNode> = {
      form: () => (
         <>
            <StepHeader title={copy.title}>{subtitle(mode)}</StepHeader>
            <div className="mt-8">
               <SignInForm
                  mode={mode}
                  initialEmail={email}
                  notice={notice}
                  githubError={githubError}
                  onGithub={() => void github()}
                  onCodeSent={(sent) => {
                     setEmail(sent);
                     setStep("code");
                  }}
                  onSignedIn={finish}
                  onSignedUp={async (created) => {
                     if (!emailLoginEnabled) {
                        await finish();
                        return;
                     }
                     setEmail(created);
                     setStep("verify");
                  }}
               />
            </div>
            <p className="mt-8 text-sm text-viewertext">
               {copy.switchPrompt}{" "}
               <Link href={switchHref} className={TEXT_LINK}>
                  {copy.switchLabel}
               </Link>
            </p>
         </>
      ),
      code: () => (
         <>
            <StepHeader title="Check your inbox">
               We sent a code and a sign-in link to <Email>{email}</Email>.{" "}
               <button
                  type="button"
                  onClick={() => setStep("form")}
                  className={TEXT_LINK}
               >
                  Edit
               </button>
            </StepHeader>
            <div className="mt-8">
               <CodeStep
                  onVerify={(code) => verifyOtp(email, code)}
                  onResend={() => requestSignInCode(email)}
                  onVerified={finish}
               />
            </div>
         </>
      ),
      verify: () => (
         <>
            <StepHeader title="Verify your email">
               We sent a code to <Email>{email}</Email>. Verifying lets you
               share servers and accept invites.
            </StepHeader>
            <div className="mt-8">
               <CodeStep
                  onVerify={(code) => verifyEmail(email, code)}
                  onResend={() => sendVerificationCode(email)}
                  onVerified={finish}
                  secondary={
                     <button
                        type="button"
                        onClick={() => void finish()}
                        className={TEXT_LINK}
                     >
                        Skip for now
                     </button>
                  }
               />
            </div>
         </>
      ),
   };

   return (
      <AuthLayout
         busy={
            leavingForGithub && (
               <Spinner size="lg" label="Opening GitHub sign-in" />
            )
         }
      >
         <div key={step} ref={stepHeight.ref} style={stepHeight.style}>
            {steps[step]()}
         </div>
      </AuthLayout>
   );
};

export default AuthScreen;
