import { authClient } from "@/lib/auth";
import useResendVerification from "@/lib/hooks/mutations/user/useResendVerification";
import { Button } from "@s3-viewer/ui/components/button";

// invites are refused until the address is verified; the callout says why
// and resends the link on the spot
const UnverifiedCallout = ({ children }: { children: string }) => {
   const { data: session } = authClient.useSession();
   const resend = useResendVerification();
   const email = session?.user.email;
   return (
      <div className="flex min-w-0 flex-col items-start gap-2 rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext">
         <p>{children}</p>
         {email && (
            <Button
               variant="outline"
               size="sm"
               loading={resend.isPending}
               onClick={() => resend.mutate(email)}
            >
               Resend verification email
            </Button>
         )}
      </div>
   );
};

export default UnverifiedCallout;
