import StatusMessage from "@/components/status-message";
import { signOut } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-redirect";
import { SESSION_FRESH_HOURS, SITE_PATHS } from "@s3-viewer/types";
import { KeyRound } from "lucide-react";
import type { ReactNode } from "react";

const signInAgain = () =>
   void signOut(loginPathFor(SITE_PATHS.settingsProfile));

type StaleSignInProps = {
   title: string;
   // what the fresh sign-in unlocks, e.g. "adding a password"
   action: string;
   className?: string;
   actions?: ReactNode;
};

const StaleSignIn = ({
   title,
   action,
   className,
   actions,
}: StaleSignInProps) => (
   <StatusMessage
      icon={KeyRound}
      title={title}
      className={className}
      actions={actions}
   >
      For your security, {action} needs a sign-in from the last{" "}
      {SESSION_FRESH_HOURS} hours. You&apos;ll come straight back to your
      settings.
   </StatusMessage>
);

export default StaleSignIn;
export { signInAgain };
