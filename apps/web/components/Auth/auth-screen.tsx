import { SIGN_UPS_BY_INVITE, SIGN_UPS_CLOSED } from "@s3-viewer/auth/client";
import { AuthLayout, StepHeader } from "./auth-layout";
import { loginNotice } from "./login-notice";
import SignInForm, { type Mode } from "./sign-in-form";
import { signInWithGithub } from "@/lib/auth";
import { afterLoginPath, inviteIdFrom } from "@/lib/auth-redirect";
import useInstanceConfig, {
   emailState,
   signUpPolicyState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { toast } from "@s3-viewer/ui/components/toast";
import { useRouter } from "next/router";
import { useState } from "react";

type AuthScreenProps = { mode: Mode };

const COPY = {
   login: {
      title: "Welcome back",
      subtitle: "Log in to your account to continue.",
   },
   signup: {
      title: "Create your account",
      subtitle: "Enter your email and pick a password.",
   },
} as const;

const AuthScreen = ({ mode }: AuthScreenProps) => {
   const router = useRouter();
   const config = useInstanceConfig();
   const transport = emailState(config);
   const signUp = signUpPolicyState(config.data).mode;
   const [githubPending, setGithubPending] = useState(false);

   const destination = afterLoginPath(router.query.next);
   const inviteId = inviteIdFrom(router.query.next);
   const effectiveMode = signUp === "closed" ? "login" : mode;
   const copy = COPY[effectiveMode];
   const notice =
      mode === "signup" && signUp === "closed"
         ? SIGN_UPS_CLOSED
         : mode === "signup" && signUp === "invite" && !inviteId
           ? SIGN_UPS_BY_INVITE
           : loginNotice(router.query);

   const github = async () => {
      setGithubPending(true);
      const { error } = await signInWithGithub(destination);
      if (error) {
         toast.error("Couldn't open GitHub login", { description: error });
         setGithubPending(false);
      }
   };

   return (
      <AuthLayout
         busy={
            (config.isPending || !router.isReady) && (
               <Spinner size="lg" label="Loading sign-in options" />
            )
         }
      >
         <StepHeader title={copy.title}>{copy.subtitle}</StepHeader>
         <SignInForm
            mode={effectiveMode}
            notice={notice}
            inviteId={inviteId}
            githubPending={githubPending}
            onGithub={() => void github()}
            onDone={async (created) => {
               if (created) {
                  toast.success("Account created", {
                     description:
                        transport === "loading"
                           ? undefined
                           : transport === "disabled"
                             ? "This instance has no email configured, so your address stays unverified."
                             : "We emailed you a link to verify your address.",
                  });
               }
               await router.replace(destination);
            }}
         />
      </AuthLayout>
   );
};

export default AuthScreen;
