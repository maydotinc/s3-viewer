import { AuthLayout, StepHeader } from "./auth-layout";
import { loginNotice } from "./login-notice";
import OperatorStep from "./operator-step";
import SignInForm, {
   type Credentials,
   type Mode,
   type Outcome,
} from "./sign-in-form";
import VerifyCodeStep from "./verify-code-step";
import { refetchSession, signInWithGithub } from "@/lib/auth";
import { afterLoginPath, inviteIdFrom } from "@/lib/auth-redirect";
import useInstanceConfig, {
   emailState,
   signUpPolicyState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { SITE_PATHS } from "@s3-viewer/shared";
import { Button } from "@s3-viewer/ui/components/button";
import { toast } from "@s3-viewer/ui/components/toast";
import { cn } from "@s3-viewer/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

type AuthScreenProps = { mode: Mode };

type Step =
   | { kind: "form"; notice?: string; focusPassword?: boolean }
   | ({ kind: "verify" } & Credentials);

const COPY = {
   login: {
      title: "Welcome back",
      subtitle: "Log in to your account to continue.",
      back: "Back to log in",
   },
   signup: {
      title: "Create your account",
      subtitle: "Enter your email and pick a password.",
      back: "Use a different email",
   },
} as const;

const BLOCKED = {
   closed: {
      title: "Sign-ups are closed",
      subtitle:
         "This instance isn't taking new accounts. Ask whoever runs it for access, or log in if you already have one.",
   },
   invite: {
      title: "Sign-ups are by invitation",
      subtitle:
         "Open the link in your invitation email to create your account, or log in if you already have one.",
   },
} as const;

// contributors run the API locally and read codes off its log
const DEVELOPMENT = process.env.NODE_ENV === "development";

// survives a refresh on the code step, so the form comes back with the address filled in
const PENDING_EMAIL_KEY = "auth:pending-email";

const readPendingEmail = (): string => {
   try {
      return window.sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "";
   } catch {
      return "";
   }
};

const writePendingEmail = (email: string | null): void => {
   try {
      if (email) window.sessionStorage.setItem(PENDING_EMAIL_KEY, email);
      else window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
   } catch {
      // storage unavailable: the address is simply typed again
   }
};

const SignUpBlocked = ({
   reason,
   next,
}: {
   reason: keyof typeof BLOCKED;
   next: string;
}) => (
   <>
      <StepHeader title={BLOCKED[reason].title}>
         {BLOCKED[reason].subtitle}
      </StepHeader>
      <Button asChild className="w-full">
         <Link
            href={{
               pathname: SITE_PATHS.login,
               query: next === SITE_PATHS.dashboard ? undefined : { next },
            }}
         >
            Log in
         </Link>
      </Button>
   </>
);

const AuthScreen = ({ mode }: AuthScreenProps) => {
   const router = useRouter();
   const config = useInstanceConfig();
   const transport = emailState(config);
   const signUp = signUpPolicyState(config.data).mode;
   const [githubPending, setGithubPending] = useState(false);
   const [step, setStep] = useState<Step>({ kind: "form" });
   const [initialEmail, setInitialEmail] = useState("");
   // the first screen is server-rendered; only later steps fade in
   const moved = useRef(false);

   useEffect(() => setInitialEmail(readPendingEmail()), []);

   const destination = afterLoginPath(router.query.next);
   const inviteId = inviteIdFrom(router.query.next);
   const copy = COPY[mode];
   const blocked =
      mode === "signup" &&
      (signUp === "closed"
         ? "closed"
         : signUp === "invite" && !inviteId
           ? "invite"
           : null);

   const go = (next: Step) => {
      moved.current = true;
      setStep(next);
   };

   const github = async () => {
      setGithubPending(true);
      const { error } = await signInWithGithub(destination);
      if (error) {
         toast.error("Couldn't open GitHub login", { description: error });
         setGithubPending(false);
      }
   };

   // a code exchange opens the session server-side without telling the session store
   const enter = async () => {
      writePendingEmail(null);
      await refetchSession();
      await router.replace(destination);
   };

   const afterCredentials = async (outcome: Outcome) => {
      if (!outcome.verificationRequired) {
         await enter();
         return;
      }
      writePendingEmail(outcome.email);
      setInitialEmail(outcome.email);
      go({ kind: "verify", email: outcome.email, password: outcome.password });
   };

   // the login page keeps the address and asks for the password again; the sign-up page starts over
   const back = (notice?: string) => {
      if (mode === "signup") {
         writePendingEmail(null);
         setInitialEmail("");
      }
      go({
         kind: "form",
         focusPassword: mode === "login",
         ...(notice && { notice }),
      });
   };

   // decided when rendering, so a config that answers late still routes a no-email instance to its operator
   const operator = transport === "disabled" && !DEVELOPMENT;

   return (
      <AuthLayout>
         <div
            key={step.kind}
            className={cn(
               "flex flex-col gap-6",
               moved.current && "animate-fade-in"
            )}
         >
            {blocked ? (
               <SignUpBlocked reason={blocked} next={destination} />
            ) : step.kind === "verify" && operator ? (
               <OperatorStep
                  email={step.email}
                  backLabel={copy.back}
                  onBack={() => back()}
               />
            ) : step.kind === "verify" ? (
               <VerifyCodeStep
                  email={step.email}
                  password={step.password}
                  codeInLog={DEVELOPMENT && transport === "disabled"}
                  backLabel={copy.back}
                  onBack={back}
                  onVerified={enter}
               />
            ) : (
               <>
                  <StepHeader title={copy.title}>{copy.subtitle}</StepHeader>
                  <SignInForm
                     mode={mode}
                     notice={step.notice ?? loginNotice(router.query)}
                     inviteId={inviteId}
                     initialEmail={initialEmail}
                     focusPassword={step.focusPassword ?? false}
                     githubPending={githubPending}
                     onGithub={() => void github()}
                     onDone={afterCredentials}
                  />
               </>
            )}
         </div>
      </AuthLayout>
   );
};

export default AuthScreen;
