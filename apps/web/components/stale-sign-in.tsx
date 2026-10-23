import StatusMessage from "@/components/status-message";
import { ApiError } from "@/lib/api";
import { requestSignOut } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-redirect";
import useAsyncAction from "@/lib/hooks/useAsyncAction";
import { toastFailure } from "@/lib/utils/toast";
import { ErrorCode, SESSION_FRESH_HOURS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { KeyRound } from "lucide-react";

// the modal or card is gone after the round trip, so landing on the same page is the closest it can get
const signOutHere = () =>
   requestSignOut(
      loginPathFor(`${window.location.pathname}${window.location.search}`)
   );

const signInAgain = () => void signOutHere().catch(toastFailure);

const isSessionStale = (error: unknown): boolean =>
   error instanceof ApiError && error.code === ErrorCode.SESSION_STALE;

type StaleSignInProps = {
   title: string;
   // what the fresh sign-in unlocks, e.g. "adding a password"
   action: string;
};

const StaleSignIn = ({ title, action }: StaleSignInProps) => {
   const { pending, run } = useAsyncAction(toastFailure);
   return (
      <StatusMessage
         icon={KeyRound}
         title={title}
         actions={
            <Button
               size="sm"
               type="button"
               loading={pending}
               onClick={() => void run(signOutHere)}
            >
               Sign in again
            </Button>
         }
      >
         For your security, {action} needs a sign-in from the last{" "}
         {SESSION_FRESH_HOURS} hours. You&apos;ll come straight back here.
      </StatusMessage>
   );
};

export default StaleSignIn;
export { isSessionStale, signInAgain };
