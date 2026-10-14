import { assignableRoles } from "@s3-viewer/permissions";
import {
   Role,
   type GrantableRole,
   type InviteOutcome,
   type S3Bucket,
   type SendInvitesResult,
} from "@s3-viewer/types";
import {
   TOO_MANY_BUCKETS,
   accessErrors,
   accessSummaryError,
   commitDrafts,
   tooManyBuckets,
   type GrantRow,
} from "../bucket-grants";
import { lowestRole } from "../roles";
import { EMPTY_EMAIL_FIELD, type EmailField } from "./email-chips";
import type { StepId } from "./wizard-text";

type ServerAccess = { role: GrantableRole; rows: GrantRow[] };

type WizardState = {
   step: StepId;
   emails: EmailField;
   selected: readonly string[];
   access: Readonly<Record<string, ServerAccess>>;
   expanded: string | null;
   accessSubmitted: boolean;
   // bumps when a failed Continue should move focus into the expanded section
   focusRequest: number;
   notify: boolean;
   result: SendInvitesResult | null;
};

type WizardAction =
   | { type: "emails"; emails: EmailField }
   | { type: "goTo"; step: StepId }
   | { type: "server"; serverId: string; checked: boolean }
   | { type: "servers"; serverIds: readonly string[] }
   | {
        type: "access";
        serverId: string;
        fallback: ServerAccess;
        update: (current: ServerAccess) => ServerAccess;
     }
   | { type: "expand"; serverId: string | null }
   | {
        type: "accessChecked";
        committed: Readonly<Record<string, GrantRow[]>>;
        failing: string | null;
     }
   | { type: "notify"; notify: boolean }
   | { type: "sent"; result: SendInvitesResult }
   | { type: "outcome"; outcome: InviteOutcome }
   | { type: "inviteMore" };

const INITIAL_WIZARD_STATE: WizardState = {
   step: "who",
   emails: EMPTY_EMAIL_FIELD,
   selected: [],
   access: {},
   expanded: null,
   accessSubmitted: false,
   focusRequest: 0,
   notify: true,
   result: null,
};

const CHOOSE_BUCKET = "Choose at least one bucket";

const defaultAccess = (myRole: Role): ServerAccess => ({
   role: lowestRole(assignableRoles(myRole)) ?? Role.VIEWER,
   rows: [],
});

const wizardReducer = (
   state: WizardState,
   action: WizardAction
): WizardState => {
   switch (action.type) {
      case "emails":
         return { ...state, emails: action.emails };
      case "goTo":
         return { ...state, step: action.step };
      case "server": {
         const without = state.selected.filter((id) => id !== action.serverId);
         return {
            ...state,
            selected: action.checked ? [...without, action.serverId] : without,
         };
      }
      case "servers":
         return { ...state, selected: [...action.serverIds] };
      case "access": {
         const current = state.access[action.serverId] ?? action.fallback;
         return {
            ...state,
            access: {
               ...state.access,
               [action.serverId]: action.update(current),
            },
         };
      }
      case "expand":
         return { ...state, expanded: action.serverId };
      case "accessChecked": {
         const access = { ...state.access };
         for (const [serverId, rows] of Object.entries(action.committed)) {
            const current = access[serverId];
            if (current) access[serverId] = { ...current, rows };
         }
         return {
            ...state,
            access,
            accessSubmitted: true,
            expanded: action.failing ?? state.expanded,
            focusRequest: action.failing
               ? state.focusRequest + 1
               : state.focusRequest,
         };
      }
      case "notify":
         return { ...state, notify: action.notify };
      case "sent":
         return { ...state, result: action.result };
      case "outcome":
         return state.result
            ? {
                 ...state,
                 result: {
                    outcomes: state.result.outcomes.map((outcome) =>
                       outcome.serverId === action.outcome.serverId
                          ? action.outcome
                          : outcome
                    ),
                 },
              }
            : state;
      case "inviteMore":
         return {
            ...state,
            step: "who",
            emails: EMPTY_EMAIL_FIELD,
            result: null,
         };
   }
};

type AccessCheckInput = {
   rows: readonly GrantRow[];
   buckets: readonly S3Bucket[];
   myRole: Role;
   serverRole: Role;
};

// the first thing wrong with one server's access, in the words the section shows
const serverAccessProblem = ({
   rows,
   buckets,
   myRole,
   serverRole,
}: AccessCheckInput): string | null => {
   if (rows.length === 0) return CHOOSE_BUCKET;
   const [invalid] = accessErrors(rows, {
      buckets,
      myRole,
      serverRole,
      drafts: true,
   });
   if (invalid) return accessSummaryError(invalid);
   return tooManyBuckets(rows) ? TOO_MANY_BUCKETS : null;
};

// row problems are already shown under their bucket and in the section header
const listLevelProblem = (problem: string | null): string | null =>
   problem === CHOOSE_BUCKET || problem === TOO_MANY_BUCKETS ? problem : null;

type SectionReadiness = {
   rows: readonly GrantRow[];
   isLoading: boolean;
   noBuckets: boolean;
};

// only what can be judged before committing drafts; the rest is revealed on click
const canContinueAccess = (sections: readonly SectionReadiness[]): boolean =>
   sections.length > 0 &&
   sections.every(
      ({ rows, isLoading, noBuckets }) =>
         !isLoading && !noBuckets && rows.length > 0
   );

type ServerCheck = AccessCheckInput & { serverId: string };

type AccessCheckResult = {
   committed: Record<string, GrantRow[]>;
   failing: string | null;
};

const checkAccess = (servers: readonly ServerCheck[]): AccessCheckResult => {
   const committed: Record<string, GrantRow[]> = {};
   let failing: string | null = null;
   for (const server of servers) {
      const rows = commitDrafts(server.rows, {
         buckets: server.buckets,
         myRole: server.myRole,
         serverRole: server.serverRole,
      });
      committed[server.serverId] = rows;
      if (failing === null && serverAccessProblem({ ...server, rows }))
         failing = server.serverId;
   }
   return { committed, failing };
};

export {
   CHOOSE_BUCKET,
   INITIAL_WIZARD_STATE,
   canContinueAccess,
   checkAccess,
   defaultAccess,
   listLevelProblem,
   serverAccessProblem,
   wizardReducer,
};
export type { ServerAccess, WizardAction, WizardState };
