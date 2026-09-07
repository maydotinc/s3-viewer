import { AuthLayout, StepHeader } from "@/components/Auth/auth-layout";
import SignInForm from "@/components/Auth/sign-in-form";
import { signInWithGithub } from "@/lib/auth";
import { afterLoginPath } from "@/lib/auth-redirect";
import useInstanceConfig, {
   emailState,
   signUpPolicyState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { toast } from "@s3-viewer/ui/components/toast";
import { useRouter } from "next/router";
import { useState } from "react";

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

const SIGN_UPS_CLOSED =
   "Sign-ups are disabled on this instance. Ask an administrator for access.";
const SIGN_UPS_BY_INVITE =
   "Sign-ups are by invitation. Use the address your invitation was sent to.";

const NOTICES: Readonly<Record<string, string>> = {
   reset: "Password updated. Log in with your new password.",
   failed: "Login didn't complete. Try again.",
   expired: "Your session has ended. Log in again to continue.",
};

const AuthScreen = ({ mode }: AuthScreenProps) => {
   const router = useRouter();
   const config = useInstanceConfig();
   const transport = emailState(config);
   const signUp = signUpPolicyState(config.data).mode;
   const [leavingForGithub, setLeavingForGithub] = useState(false);

   const destination = afterLoginPath(router.query.next);
   // with sign-ups closed there is nothing to create, so /signup becomes the
   // login screen and says why instead of showing a form that always refuses.
   // `invite` keeps the form: an invited address has an account to create
   const effectiveMode = signUp === "closed" ? "login" : mode;
   const copy = COPY[effectiveMode];
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
   const notice =
      mode === "signup" && signUp === "closed"
         ? SIGN_UPS_CLOSED
         : mode === "signup" && signUp === "invite"
           ? SIGN_UPS_BY_INVITE
           : Object.hasOwn(NOTICES, reason)
             ? (NOTICES[reason] ?? null)
             : null;

   // the guard sends a signed-in visitor on as well, but only once the session
   // refetch lands; going now keeps the form in its pending state until then
   const finish = async () => {
      await router.replace(destination);
   };

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
               mode={effectiveMode}
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
