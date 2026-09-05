import { AuthLayout, StepHeader } from "@/components/Auth/auth-layout";
import SignInForm from "@/components/Auth/sign-in-form";
import FullPageSpinner from "@/components/Session/full-page-spinner";
import { signInWithGithub } from "@/lib/auth";
import { afterLoginPath } from "@/lib/auth-redirect";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { toast } from "@s3-viewer/ui/components/toast";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

type Mode = "login" | "signup";

type AuthScreenProps = { mode: Mode };

// both pages run one flow: a password signs in or, for a new address,
// creates the account. The switch between them is the header's account nav
const COPY = {
   login: {
      title: "Welcome back",
      subtitle: "Enter your email and password.",
   },
   signup: {
      title: "Create your account",
      subtitle: "Enter your email and pick a password.",
   },
} as const;

const NOTICES: Readonly<Record<string, string>> = {
   reset: "Password updated. Log in with your new password.",
   failed: "Login didn't complete. Try again.",
};

const AuthScreen = ({ mode }: AuthScreenProps) => {
   const router = useRouter();
   const sessionState = useSessionState();
   const [leavingForGithub, setLeavingForGithub] = useState(false);
   const [githubError, setGithubError] = useState<string | null>(null);
   const redirected = useRef(false);

   const destination = afterLoginPath(router.query.next);
   const copy = COPY[mode];
   // `error` is what better auth appends when an oauth callback fails and
   // redirects here; `reason` is what our own pages append
   const reason =
      typeof router.query.reason === "string"
         ? router.query.reason
         : typeof router.query.error === "string"
           ? "failed"
           : "";
   // own-property only: ?reason=toString would otherwise hand a prototype
   // function to react as a child.
   const notice = Object.hasOwn(NOTICES, reason)
      ? (NOTICES[reason] ?? null)
      : null;

   const finish = async () => {
      redirected.current = true;
      await router.replace(destination);
   };

   useEffect(() => {
      if (sessionState !== "signedIn" || redirected.current) return;
      redirected.current = true;
      void router.replace(destination);
   }, [sessionState, destination, router]);

   const github = async () => {
      setGithubError(null);
      setLeavingForGithub(true);
      const { error } = await signInWithGithub();
      if (error) {
         setGithubError(error);
         setLeavingForGithub(false);
      }
   };

   if (sessionState !== "signedOut") return <FullPageSpinner />;

   return (
      <AuthLayout
         busy={
            leavingForGithub && (
               <Spinner size="lg" label="Opening GitHub login" />
            )
         }
      >
         <StepHeader title={copy.title}>{copy.subtitle}</StepHeader>
         <div className="mt-8">
            <SignInForm
               mode={mode}
               notice={notice}
               githubError={githubError}
               onGithub={() => void github()}
               onDone={async (created) => {
                  if (created) {
                     toast.success("Account created", {
                        description:
                           "We emailed you a link to verify your address.",
                     });
                  }
                  await finish();
               }}
            />
         </div>
      </AuthLayout>
   );
};

export default AuthScreen;
