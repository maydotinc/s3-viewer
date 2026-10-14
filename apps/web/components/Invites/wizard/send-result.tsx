import Callout from "@/components/callout";
import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import type { InviteOutcome, ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { CircleAlert } from "lucide-react";
import {
   alreadyMembersText,
   invitedText,
   unemailedAddresses,
   unemailedText,
} from "./wizard-text";

type SendResultProps = {
   outcomes: readonly InviteOutcome[];
   servers: readonly ServerInfo[];
   // the server whose invites are being resent, if any
   retrying: string | null;
   disabled?: boolean;
   onRetry: (serverId: string) => void;
};

const OutcomeRow = ({
   outcome,
   server,
   retrying,
   disabled,
   onRetry,
}: {
   outcome: InviteOutcome;
   server: ServerInfo | undefined;
   retrying: boolean;
   disabled?: boolean;
   onRetry: (serverId: string) => void;
}) => {
   const invited = outcome.invites.map(({ email }) => email);
   return (
      <li className="flex min-h-12 items-start gap-3 px-3 py-2">
         {server ? (
            <ServerLogo provider={server.provider} />
         ) : (
            <span aria-hidden="true" className="size-6 shrink-0" />
         )}
         <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-viewerblack">
               {server?.name ?? outcome.serverId}
            </span>
            <div className="flex min-w-0 flex-col text-xs leading-5">
               {outcome.error !== null ? (
                  <div className="flex min-w-0 flex-col items-start gap-2">
                     <p
                        role="alert"
                        className="flex min-w-0 items-start gap-1.5 text-viewerblack"
                     >
                        <CircleAlert
                           aria-hidden="true"
                           className="mt-0.5 size-4 shrink-0 text-viewertextred"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                           {outcome.error}
                        </span>
                     </p>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={retrying}
                        disabled={disabled}
                        onClick={() => onRetry(outcome.serverId)}
                     >
                        Try again
                     </Button>
                  </div>
               ) : (
                  <>
                     {invited.length > 0 && (
                        <p className="text-viewertext [overflow-wrap:anywhere]">
                           {invitedText(invited)}
                        </p>
                     )}
                     {outcome.alreadyMembers.length > 0 && (
                        <p className="text-viewertext [overflow-wrap:anywhere]">
                           {alreadyMembersText(outcome.alreadyMembers)}
                        </p>
                     )}
                  </>
               )}
            </div>
         </div>
      </li>
   );
};

const SendResult = ({
   outcomes,
   servers,
   retrying,
   disabled,
   onRetry,
}: SendResultProps) => {
   const unemailed = unemailedAddresses(outcomes);
   return (
      <div
         role="status"
         aria-live="polite"
         className="flex min-w-0 flex-col gap-4"
      >
         <ul className="divide-y divide-viewerborder rounded-lg border border-viewerborder">
            {outcomes.map((outcome) => (
               <OutcomeRow
                  key={outcome.serverId}
                  outcome={outcome}
                  server={servers.find(({ id }) => id === outcome.serverId)}
                  retrying={retrying === outcome.serverId}
                  disabled={disabled}
                  onRetry={onRetry}
               />
            ))}
         </ul>
         {unemailed.length > 0 && (
            <Callout>
               <p>{unemailedText(unemailed)}</p>
            </Callout>
         )}
      </div>
   );
};

export default SendResult;
