import Callout from "@/components/callout";
import StatusMessage from "@/components/status-message";
import { authClient } from "@/lib/auth";
import useResendVerification from "@/lib/hooks/mutations/user/useResendVerification";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Button } from "@s3-viewer/ui/components/button";
import { Copy, MailWarning } from "lucide-react";

type UnverifiedCalloutProps = { action: string; panel?: boolean };

const DEVELOPMENT = process.env.NODE_ENV === "development";

const verifyCommand = (email: string) => `pnpm account:verify ${email}`;

const CopyButton = ({ text, label }: { text: string; label: string }) => (
   <Button
      variant="outline"
      size="sm"
      onClick={() =>
         void copyToClipboard(text, {
            success: "Copied to clipboard.",
            failure: `Couldn't copy the ${label}`,
         })
      }
   >
      <Copy aria-hidden="true" />
      Copy {label}
   </Button>
);

const OperatorMessage = ({
   email,
   action,
}: {
   email: string;
   action: string;
}) =>
   DEVELOPMENT ? (
      <>
         Email is off on this instance, so whoever runs it verifies accounts
         from the terminal. If that&apos;s you, run{" "}
         <code className="rounded bg-viewergray px-1 py-0.5 font-mono text-xs text-viewerblack [overflow-wrap:anywhere]">
            {verifyCommand(email)}
         </code>{" "}
         and follow the step it prints, then sign in again. Otherwise, ask them
         to verify your account so you can {action}.
      </>
   ) : (
      <>
         Email is off on this instance, so whoever runs it verifies accounts by
         hand; the self-hosting guide shows them how. Send them your address,{" "}
         <span className="font-medium text-viewerblack [overflow-wrap:anywhere]">
            {email}
         </span>
         , and sign in again once they&apos;ve verified it so you can {action}.
      </>
   );

const UnverifiedCallout = ({
   action,
   panel = false,
}: UnverifiedCalloutProps) => {
   const { data: session } = authClient.useSession();
   const transport = emailState(useInstanceConfig());
   const resend = useResendVerification();
   const email = session?.user.email;
   const noEmail = transport === "disabled";
   if (transport === "loading") return null;
   const operator = noEmail && email ? email : null;
   const message = operator ? (
      <OperatorMessage email={operator} action={action} />
   ) : noEmail ? (
      `To ${action}, ask the instance operator to verify your account or enable email, then sign in again.`
   ) : (
      `Verify your email address to ${action}.`
   );
   const button = operator ? (
      <CopyButton
         text={DEVELOPMENT ? verifyCommand(operator) : operator}
         label={DEVELOPMENT ? "command" : "email address"}
      />
   ) : (
      email &&
      !noEmail && (
         <Button
            variant="outline"
            size="sm"
            loading={resend.isPending}
            onClick={() => resend.mutate(email)}
         >
            Resend verification email
         </Button>
      )
   );
   if (panel) {
      return (
         <StatusMessage
            icon={MailWarning}
            title={
               noEmail
                  ? "Your account isn't verified yet"
                  : "Your email isn't verified yet"
            }
            actions={button}
         >
            {message}
         </StatusMessage>
      );
   }
   return (
      <Callout>
         <p>{message}</p>
         {button}
      </Callout>
   );
};

export default UnverifiedCallout;
