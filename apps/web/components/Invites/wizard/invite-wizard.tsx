import SettingsCard from "@/components/Settings/card";
import useSendInvites from "@/lib/hooks/mutations/invites/useSendInvites";
import useServers from "@/lib/hooks/queries/server/useServers";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { useUserId } from "@/lib/stores/session-store";
import {
   SITE_PATHS,
   type InviteOutcome,
   type InviteTarget,
   type ServerInfo,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
   useCallback,
   useEffect,
   useMemo,
   useReducer,
   useRef,
   useState,
} from "react";
import { grantPayload, type GrantRow } from "../bucket-grants";
import { manageableServers } from "../manageable";
import { canContinue as canContinueWho, commitInput } from "./email-chips";
import SendResult from "./send-result";
import StepAccess from "./step-access";
import StepReview from "./step-review";
import StepWhere from "./step-where";
import StepWho from "./step-who";
import Stepper from "./stepper";
import useServerBuckets from "./use-server-buckets";
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
   wizardSteps,
   type StepId,
} from "./wizard-text";

const NO_IDS: string[] = [];
const NO_ROWS: GrantRow[] = [];

const FOOTER =
   "flex items-center justify-between gap-3 border-t border-viewerborder px-4 py-3 sm:px-6";

const InviteWizard = () => {
   const router = useRouter();
   const userId = useUserId();
   const {
      servers,
      isSessionPending,
      isServerListLoading,
      hasNextPage,
      serverListError,
      isFetching,
      isFetchNextPageError,
      fetchNextPage,
      refetch,
   } = useServers();
   const email = emailState(useInstanceConfig());
   const sendInvites = useSendInvites();
   const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
   const [requestError, setRequestError] = useState<string | null>(null);
   const [retrying, setRetrying] = useState<string | null>(null);
   const [announcement, setAnnouncement] = useState("");
   const cardRef = useRef<HTMLDivElement>(null);
   const { step, emails, access, result } = state;
   // an email goes out only when the instance can send one and the sender kept the toggle on
   const notify = email === "enabled" && state.notify;

   const manageable = useMemo(() => manageableServers(servers), [servers]);
   const listLoading = isSessionPending || isServerListLoading;
   const stepsKnown = Boolean(serverListError) || !listLoading;
   const only =
      stepsKnown && manageable.length === 1 && !hasNextPage && !serverListError
         ? manageable[0]
         : undefined;
   const hasWhere = only === undefined;
   const steps = useMemo(() => wizardSteps(hasWhere), [hasWhere]);

   // the list can resolve to a single server while the user is already on Where
   useEffect(() => {
      if (!hasWhere && step === "where")
         dispatch({ type: "goTo", step: "access" });
   }, [hasWhere, step]);

   const preselected = useRef(false);
   const wanted = router.query.server;
   useEffect(() => {
      if (preselected.current || !router.isReady) return;
      if (typeof wanted !== "string") {
         preselected.current = true;
         return;
      }
      if (!manageable.some(({ id }) => id === wanted)) return;
      preselected.current = true;
      dispatch({ type: "server", serverId: wanted, checked: true });
   }, [router.isReady, wanted, manageable]);

   // the single manageable server is selected for the user, so a list that later grows keeps it
   useEffect(() => {
      if (only && !state.selected.includes(only.id))
         dispatch({ type: "servers", serverIds: [only.id] });
   }, [only, state.selected]);

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
      sendInvites.mutate(
         { emails: emails.chips, targets: targetsFor(selectedIds), notify },
         {
            onSuccess: (sent) => dispatch({ type: "sent", result: sent }),
            onError: (error) => setRequestError(error.message),
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
            pages={{
               hasNextPage,
               isFetching,
               error: serverListError,
               isFetchNextPageError,
               fetchNextPage,
               refetch,
            }}
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
         <div className={FOOTER}>
            <Button type="button" variant="outline" disabled={sending} asChild>
               <Link
                  href={SITE_PATHS.settingsInvites}
                  aria-disabled={sending || undefined}
               >
                  Back to invites
               </Link>
            </Button>
            <Button
               type="button"
               disabled={sending}
               onClick={() => dispatch({ type: "inviteMore" })}
            >
               Invite more people
            </Button>
         </div>
      ) : (
         <div
            className={cn(
               FOOTER,
               "max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-px max-md:bg-viewerwhite"
            )}
         >
            {step === "who" ? (
               <Button variant="outline" className="w-24" asChild>
                  <Link href={SITE_PATHS.settingsInvites}>Cancel</Link>
               </Button>
            ) : (
               <Button
                  type="button"
                  variant="outline"
                  className="w-24"
                  disabled={sending}
                  onClick={back}
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
                  onClick={send}
               >
                  {sendLabel(
                     notify,
                     emails.chips.length,
                     selectedServers.length
                  )}
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

   return (
      <div className="flex min-w-0 flex-col gap-4">
         <div className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
         </div>
         <div className="flex h-9 items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
               <Link
                  href={SITE_PATHS.settingsInvites}
                  aria-label="Back to invites"
               >
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
