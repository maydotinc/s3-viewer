import { AuthLayout, StepHeader } from "@/components/Auth/auth-layout";
import SignInForm from "@/components/Auth/sign-in-form";
import FullPageSpinner from "@/components/Session/full-page-spinner";
import { signInWithGithub } from "@/lib/auth";
import { afterLoginPath } from "@/lib/auth-redirect";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { toast } from "@s3-viewer/ui/components/toast";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

type Mode = "login" | "signup";

type AuthScreenProps = { mode: Mode };

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
   const config = useInstanceConfig();
   const transport = emailState(config);
   const [leavingForGithub, setLeavingForGithub] = useState(false);
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

   // a failure here happens before the form is shown again; a toast keeps it
   // from inserting a line into the form when it comes back
   const github = async () => {
      setLeavingForGithub(true);
      const { error } = await signInWithGithub();
      if (error) {
         toast.error("Couldn't open GitHub login", { description: error });
         setLeavingForGithub(false);
      }
   };

   // the form waits for the query string (the notice) and the instance config
   // (the github button), so nothing appears inside it after it is shown.
   // `isLoading` rather than `isPending`: a config fetch that is paused
   // offline should not hold the page on a spinner
   if (!router.isReady || sessionState !== "signedOut" || config.isLoading) {
      return <FullPageSpinner />;
   }

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
               onGithub={() => void github()}
               onDone={async (created) => {
                  if (created) {
                     toast.success("Account created", {
                        // no line at all beats promising an email that may
                        // never come, or denying one that will
                        description:
                           transport === "loading"
                              ? undefined
                              : transport === "disabled"
                                ? "This instance has no email configured, so your address stays unverified."
                                : "We emailed you a link to verify your address.",
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
