import Callout from "@/components/callout";
import { authClient } from "@/lib/auth";
import useResendVerification from "@/lib/hooks/mutations/user/useResendVerification";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { Button } from "@s3-viewer/ui/components/button";

// invites and credentials are refused until the address is verified; the
// callout says why and resends the link on the spot. an instance with no email
// configured can send nothing, so it says that instead
const UnverifiedCallout = ({ action }: { action: string }) => {
   const { data: session } = authClient.useSession();
   const transport = emailState(useInstanceConfig());
   const resend = useResendVerification();
   const email = session?.user.email;
   const noEmail = transport === "disabled";
   // which of the two things to say isn't known yet, and neither is safe to guess
   if (transport === "loading") return null;
   return (
      <Callout>
         <p>
            {noEmail
               ? `To ${action}, ask the instance operator to verify your account or enable email, then sign in again.`
               : `Verify your email address to ${action}.`}
         </p>
         {email && !noEmail && (
            <Button
               variant="outline"
               size="sm"
               loading={resend.isPending}
               onClick={() => resend.mutate(email)}
            >
               Resend verification email
            </Button>
         )}
      </Callout>
   );
};

export default UnverifiedCallout;
