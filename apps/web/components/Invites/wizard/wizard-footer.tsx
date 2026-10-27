import { membersPath } from "@/lib/server-paths";
import { SITE_PATHS } from "@s3-viewer/shared";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import Link from "next/link";
import type { StepId } from "./wizard-text";

const FOOTER =
   "flex items-center justify-between gap-3 border-t border-viewerborder px-4 py-3 sm:px-6";

const ResultFooter = ({
   serverId,
   sending,
   onInviteMore,
}: {
   serverId: string | undefined;
   sending: boolean;
   onInviteMore: () => void;
}) => (
   <div className={FOOTER}>
      <Button type="button" variant="outline" disabled={sending} asChild>
         <Link
            href={
               serverId
                  ? membersPath(serverId, "pending")
                  : SITE_PATHS.settingsMembers
            }
            aria-disabled={sending || undefined}
         >
            View pending invites
         </Link>
      </Button>
      <Button type="button" disabled={sending} onClick={onInviteMore}>
         Invite more people
      </Button>
   </div>
);

const StepFooter = ({
   step,
   backHref,
   sending,
   continueEnabled,
   sendLabel,
   onBack,
   onContinue,
   onSend,
}: {
   step: StepId;
   backHref: string;
   sending: boolean;
   continueEnabled: boolean;
   sendLabel: string;
   onBack: () => void;
   onContinue: () => void;
   onSend: () => void;
}) => (
   <div
      className={cn(
         FOOTER,
         "max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-px max-md:bg-viewerwhite"
      )}
   >
      {step === "who" ? (
         <Button variant="outline" className="w-24" asChild>
            <Link href={backHref}>Cancel</Link>
         </Button>
      ) : (
         <Button
            type="button"
            variant="outline"
            className="w-24"
            disabled={sending}
            onClick={onBack}
         >
            Back
         </Button>
      )}
      {step === "review" ? (
         <Button
            type="button"
            className="min-w-44 max-md:flex-1"
            loading={sending}
            disabled={!continueEnabled}
            onClick={onSend}
         >
            {sendLabel}
         </Button>
      ) : (
         <Button
            type="button"
            className="min-w-32 max-md:flex-1"
            disabled={!continueEnabled || sending}
            onClick={onContinue}
         >
            Continue
         </Button>
      )}
   </div>
);

export { ResultFooter, StepFooter };
