import { StepHeader } from "./auth-layout";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Button } from "@s3-viewer/ui/components/button";
import { Copy } from "lucide-react";

type OperatorStepProps = {
   email: string;
   backLabel: string;
   onBack: () => void;
};

// instances without an email transport cannot send a code; the operator verifies by hand
const OperatorStep = ({ email, backLabel, onBack }: OperatorStepProps) => (
   <>
      <StepHeader title="Your account needs verifying">
         This instance can&apos;t send email, so whoever runs it verifies
         accounts by hand. Send them this address and log in once they have.
      </StepHeader>
      <div className="flex items-center gap-2 rounded-lg border border-viewerborder bg-viewergray py-2 pl-3 pr-2">
         <span className="min-w-0 flex-1 truncate text-sm font-medium text-viewerblack">
            {email}
         </span>
         <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
               void copyToClipboard(email, {
                  success: "Copied to clipboard.",
                  failure: "Couldn't copy the email address",
               })
            }
         >
            <Copy aria-hidden="true" />
            Copy
         </Button>
      </div>
      <Button type="button" className="w-full" onClick={onBack}>
         {backLabel}
      </Button>
   </>
);

export default OperatorStep;
