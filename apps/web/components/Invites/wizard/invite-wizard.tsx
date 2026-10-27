import SettingsCard from "@/components/Settings/card";
import { isSessionStale } from "@/components/stale-sign-in";
import useSendInvites from "@/lib/hooks/mutations/invites/useSendInvites";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { useUserId } from "@/lib/stores/session-store";
import type {
   InviteOutcome,
   InviteTarget,
   ServerInfo,
} from "@s3-viewer/shared";
import { Button } from "@s3-viewer/ui/components/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import {
   useCallback,
   useEffect,
   useMemo,
   useReducer,
   useRef,
   useState,
} from "react";
import { grantPayload, type GrantRow } from "../bucket-grants";
import { canContinue as canContinueWho, commitInput } from "./email-chips";
import SendResult from "./send-result";
import StepAccess from "./step-access";
import StepReview from "./step-review";
import StepWhere from "./step-where";
import StepWho from "./step-who";
import Stepper from "./stepper";
import useServerBuckets from "./useServerBuckets";
import useWizardServers from "./useWizardServers";
import { ResultFooter, StepFooter } from "./wizard-footer";
import {
   INITIAL_WIZARD_STATE,
   canContinueAccess,
   checkAccess,
   defaultAccess,
   wizardReducer,
   type ServerAccess,
} from "./wizard-state";
import {
   STEP_TITLES,
   contextLine,
   resultTitle,
   sendLabel,
   stepAnnouncement,
   type StepId,
} from "./wizard-text";

const NO_IDS: string[] = [];
const NO_ROWS: GrantRow[] = [];

const InviteWizard = () => {
   const userId = useUserId();
   const email = emailState(useInstanceConfig());
   const sendInvites = useSendInvites();
   const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
   const [requestError, setRequestError] = useState<string | null>(null);
   const [staleSession, setStaleSession] = useState(false);
   const [retrying, setRetrying] = useState<string | null>(null);
   const [announcement, setAnnouncement] = useState("");
   const cardRef = useRef<HTMLDivElement>(null);
   const { step, emails, access, result } = state;
   // an email goes out only when the instance can send one and the sender kept the toggle on
   const notify = email === "enabled" && state.notify;

   const { manageable, listLoading, stepsKnown, only, steps, backHref, pages } =
      useWizardServers(state, dispatch);

   // the result replaces the review body under the same step, so it counts as a view of its own
   const view = result !== null ? "result" : step;
   const previousView = useRef(view);
   useEffect(() => {
      if (previousView.current === view) return;
      previousView.current = view;
      setAnnouncement(
         result !== null
            ? resultTitle(result.outcomes, notify)
            : stepAnnouncement(steps, step)
      );
      const card = cardRef.current;
      card?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      card?.scrollIntoView?.({ block: "nearest" });
   }, [view, step, steps, result, notify]);

   const selectedSet = useMemo(() => new Set(state.selected), [state.selected]);
   const selectedServers = useMemo<ServerInfo[]>(
      () =>
         only ? [only] : manageable.filter(({ id }) => selectedSet.has(id)),
      [only, manageable, selectedSet]
   );
   const selectedIds = useMemo(
      () => selectedServers.map(({ id }) => id),
      [selectedServers]
   );
   const buckets = useServerBuckets(
      userId,
      step === "who" || step === "where" ? NO_IDS : selectedIds
   );
   const accessFor = useCallback(
      (server: ServerInfo): ServerAccess =>
         access[server.id] ?? defaultAccess(server.userRole),
      [access]
   );

   const sending = sendInvites.isPending;
   const accessReady = canContinueAccess(
      selectedServers.map((server, index) => {
         const loaded = buckets[index];
         return {
            rows: access[server.id]?.rows ?? NO_ROWS,
            isLoading: loaded?.isLoading ?? true,
            noBuckets:
               loaded !== undefined &&
               !loaded.isLoading &&
               loaded.error === null &&
               loaded.buckets.length === 0,
         };
      })
   );
   const continueEnabled =
      step === "who"
         ? canContinueWho(emails)
         : step === "where"
           ? selectedServers.length > 0
           : step === "access"
             ? accessReady
             : email !== "loading";

   const goTo = useCallback(
      (next: StepId) => dispatch({ type: "goTo", step: next }),
      []
   );
   const back = () => {
      const previous = steps[steps.indexOf(step) - 1];
      if (previous) goTo(previous);
   };
   const advance = () => {
      const next = steps[steps.indexOf(step) + 1];
      if (next) goTo(next);
   };

   const targetsFor = (serverIds: readonly string[]): InviteTarget[] =>
      selectedServers
         .filter(({ id }) => serverIds.includes(id))
         .map((server) => {
            const { role, rows } = accessFor(server);
            return {
               serverId: server.id,
               role,
               bucketAccess: grantPayload(rows),
            };
         });

   const send = () => {
      setRequestError(null);
      setStaleSession(false);
      sendInvites.mutate(
         { emails: emails.chips, targets: targetsFor(selectedIds), notify },
         {
            onSuccess: (sent) => dispatch({ type: "sent", result: sent }),
            onError: (error) => {
               if (isSessionStale(error)) setStaleSession(true);
               else setRequestError(error.message);
            },
         }
      );
   };

   const retryServer = (serverId: string) => {
      setRetrying(serverId);
      const failed = (message: string): InviteOutcome => ({
         serverId,
         invites: [],
         alreadyMembers: [],
         error: message,
      });
      sendInvites.mutate(
         { emails: emails.chips, targets: targetsFor([serverId]), notify },
         {
            onSuccess: (sent) =>
               dispatch({
                  type: "outcome",
                  outcome:
                     sent.outcomes.find(
                        (outcome) => outcome.serverId === serverId
                     ) ?? failed("The server did not report an outcome."),
               }),
            onError: (error) =>
               dispatch({ type: "outcome", outcome: failed(error.message) }),
            onSettled: () => setRetrying(null),
         }
      );
   };

   const onContinue = () => {
      if (step === "who") {
         const committed = commitInput(emails);
         if (committed !== emails)
            dispatch({ type: "emails", emails: committed });
         if (canContinueWho(committed)) advance();
         return;
      }
      if (step === "access") {
         const { committed, failing } = checkAccess(
            selectedServers.map((server, index) => ({
               serverId: server.id,
               rows: accessFor(server).rows,
               buckets: buckets[index]?.buckets ?? [],
               myRole: server.userRole,
               serverRole: accessFor(server).role,
            }))
         );
         dispatch({ type: "accessChecked", committed, failing });
         if (!failing) advance();
         return;
      }
      advance();
   };

   const onAccessChange = useCallback(
      (
         serverId: string,
         fallback: ServerAccess,
         update: (current: ServerAccess) => ServerAccess
      ) => dispatch({ type: "access", serverId, fallback, update }),
      []
   );
   const onExpand = useCallback(
      (serverId: string) => dispatch({ type: "expand", serverId }),
      []
   );
   const onRemove = useCallback(
      (serverId: string) =>
         dispatch({ type: "server", serverId, checked: false }),
      []
   );
   const onToggleServer = useCallback(
      (serverId: string, checked: boolean) =>
         dispatch({ type: "server", serverId, checked }),
      []
   );
   const onSelectAll = useCallback(
      (serverIds: readonly string[]) =>
         dispatch({ type: "servers", serverIds }),
      []
   );
   const onEmails = useCallback(
      (next: typeof emails) => dispatch({ type: "emails", emails: next }),
      []
   );
   const editServer = (serverId: string) => {
      dispatch({ type: "expand", serverId });
      goTo("access");
   };

   const body =
      result !== null ? (
         <SendResult
            outcomes={result.outcomes}
            servers={selectedServers}
            retrying={retrying}
            notified={notify}
            disabled={sending}
            onRetry={retryServer}
         />
      ) : step === "who" ? (
         <StepWho
            value={emails}
            canContinue={continueEnabled}
            onChange={onEmails}
            onContinue={onContinue}
         />
      ) : step === "where" ? (
         <StepWhere
            servers={manageable}
            selected={selectedSet}
            loading={listLoading}
            pages={pages}
            onToggle={onToggleServer}
            onSelectAll={onSelectAll}
         />
      ) : step === "access" ? (
         <StepAccess
            servers={selectedServers}
            buckets={buckets}
            access={access}
            expanded={state.expanded}
            submitted={state.accessSubmitted}
            focusRequest={state.focusRequest}
            onAccessChange={onAccessChange}
            onExpand={onExpand}
            onRemove={onRemove}
         />
      ) : (
         <StepReview
            emails={emails.chips}
            servers={selectedServers.map((server) => ({
               server,
               access: accessFor(server),
            }))}
            email={email}
            notify={state.notify}
            requestError={requestError}
            staleSession={staleSession}
            retrying={sending}
            disabled={sending}
            onNotifyChange={(next) =>
               dispatch({ type: "notify", notify: next })
            }
            onEditPeople={() => goTo("who")}
            onEditServer={editServer}
            onRetry={send}
         />
      );

   const footer =
      result !== null ? (
         <ResultFooter
            serverId={selectedIds[0]}
            sending={sending}
            onInviteMore={() => dispatch({ type: "inviteMore" })}
         />
      ) : (
         <StepFooter
            step={step}
            backHref={backHref}
            sending={sending}
            continueEnabled={continueEnabled}
            sendLabel={sendLabel(
               notify,
               emails.chips.length,
               selectedServers.length
            )}
            onBack={back}
            onContinue={onContinue}
            onSend={send}
         />
      );

   return (
      <div className="flex min-w-0 flex-col gap-4">
         <div className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
         </div>
         <div className="flex h-9 items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
               <Link href={backHref} aria-label="Back to members">
                  <ChevronLeft aria-hidden="true" />
               </Link>
            </Button>
            <h2 className="text-lg font-semibold text-viewerblack">
               Invite people
            </h2>
         </div>
         <div className="mt-1">
            <Stepper
               steps={steps}
               current={step}
               finished={result !== null}
               loading={!stepsKnown}
               onSelect={goTo}
            />
         </div>
         <div ref={cardRef}>
            <SettingsCard
               flush
               className="max-md:overflow-visible"
               title={
                  result !== null
                     ? resultTitle(result.outcomes, notify)
                     : STEP_TITLES[step]
               }
               description={
                  result !== null ? undefined : (
                     <span className="block min-h-5 truncate">
                        {contextLine(
                           step,
                           emails.chips,
                           selectedServers.map(({ name }) => name)
                        )}
                     </span>
                  )
               }
            >
               <div className="flex min-h-72 flex-col px-4 py-5 sm:px-6">
                  {body}
               </div>
               {footer}
            </SettingsCard>
         </div>
      </div>
   );
};

export default InviteWizard;
