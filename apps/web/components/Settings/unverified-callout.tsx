import VerifyEmailDialog from "@/components/Settings/verify-email-dialog";
import { authClient } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { Button } from "@s3-viewer/ui/components/button";
import { useState } from "react";

// invites are refused until the address is verified; the callout says why
// and, where a code can be sent, offers to do it on the spot
const UnverifiedCallout = ({ children }: { children: string }) => {
   const { data: session } = authClient.useSession();
   const [verifying, setVerifying] = useState(false);
   const email = session?.user.email;
   const canVerify = publicEnv.emailLoginEnabled && Boolean(email);
   return (
      <div className="flex min-w-0 flex-col items-start gap-2 rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext">
         <p>
            {children}
            {!canVerify &&
               " This deployment sends no email, so addresses can't be verified."}
         </p>
         {canVerify && (
            <Button
               variant="outline"
               size="sm"
               onClick={() => setVerifying(true)}
            >
               Verify email
            </Button>
         )}
         {verifying && email && (
            <VerifyEmailDialog
               email={email}
               onClose={() => setVerifying(false)}
            />
         )}
      </div>
   );
};

export default UnverifiedCallout;
