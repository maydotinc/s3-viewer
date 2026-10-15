import { pluralize } from "@/lib/utils/format";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import {
   INVITE_TTL_DAYS,
   joinList,
   type InviteOutcome,
   type Role,
} from "@s3-viewer/types";

type StepId = "who" | "where" | "access" | "review";

const ALL_STEPS: readonly StepId[] = ["who", "where", "access", "review"];

const STEP_LABELS: Readonly<Record<StepId, string>> = {
   who: "Who",
   where: "Where",
   access: "Access",
   review: "Review",
};

const STEP_TITLES: Readonly<Record<StepId, string>> = {
   who: "Who are you inviting?",
   where: "Which servers?",
   access: "What can they access?",
   review: "Review and send",
};

const WHO_DESCRIPTION = `Invites expire after ${INVITE_TTL_DAYS} days. They only see the servers and buckets you choose next.`;

const wizardSteps = (hasWhere: boolean): StepId[] =>
   ALL_STEPS.filter((step) => hasWhere || step !== "where");

const peopleText = (emails: readonly string[]): string => {
   const [first, ...rest] = emails;
   if (!first) return "";
   if (rest.length === 0) return first;
   return rest.length === 1
      ? `${first} and 1 other`
      : `${first} and ${rest.length} others`;
};

const serversText = (names: readonly string[]): string =>
   names.length === 1 ? names[0]! : pluralize(names.length, "server");

const contextLine = (
   step: StepId,
   emails: readonly string[],
   serverNames: readonly string[]
): string => {
   if (step === "who") return WHO_DESCRIPTION;
   if (step === "where") return `Inviting ${peopleText(emails)}`;
   return `Inviting ${peopleText(emails)} to ${serversText(serverNames)}`;
};

const stepAnnouncement = (steps: readonly StepId[], current: StepId): string =>
   `Step ${steps.indexOf(current) + 1} of ${steps.length}, ${STEP_LABELS[current]}`;

const sendLabel = (
   emailEnabled: boolean,
   people: number,
   servers: number
): string => {
   const verb = emailEnabled ? "Send" : "Save";
   const invites = people === 1 ? "invite" : `${people} invites`;
   return servers === 1
      ? `${verb} ${invites}`
      : `${verb} ${invites} to ${servers} servers`;
};

type StatusTone = "muted" | "set" | "error";

type AccessStatusInput = {
   role: Role;
   checked: number;
   grantable: number;
   noBuckets: boolean;
   problem: string | null;
};

const accessStatus = ({
   role,
   checked,
   grantable,
   noBuckets,
   problem,
}: AccessStatusInput): { text: string; tone: StatusTone } => {
   if (problem) return { text: problem, tone: "error" };
   if (noBuckets) return { text: "No buckets to share", tone: "muted" };
   if (checked === 0) return { text: "Not set up yet", tone: "muted" };
   const scope =
      grantable > 0 && checked >= grantable
         ? "all buckets"
         : pluralize(checked, "bucket");
   return { text: `${ROLE_LABELS[role]} · ${scope}`, tone: "set" };
};

const resultTitle = (
   outcomes: readonly InviteOutcome[],
   emailEnabled: boolean
): string => {
   const failed = outcomes.filter(({ error }) => error !== null).length;
   if (failed === 0) return emailEnabled ? "Invites sent" : "Invites saved";
   if (failed === outcomes.length) return "Couldn't send invites";
   return `Sent to ${outcomes.length - failed} of ${outcomes.length} servers`;
};

const invitedText = (emails: readonly string[]): string =>
   `Invited ${joinList(emails)}`;

const alreadyMembersText = (emails: readonly string[]): string =>
   emails.length === 1
      ? `${emails[0]} is already a member`
      : `${joinList(emails)} are already members`;

const unemailedText = (emails: readonly string[]): string =>
   `Saved, but no email went to ${joinList(emails)}. Ask them to sign in with ${emails.length === 1 ? "that address" : "those addresses"} and open Settings, Invitations.`;

const unemailedAddresses = (outcomes: readonly InviteOutcome[]): string[] => [
   ...new Set(
      outcomes.flatMap(({ invites }) =>
         invites.filter(({ emailed }) => !emailed).map(({ email }) => email)
      )
   ),
];

export {
   STEP_LABELS,
   STEP_TITLES,
   accessStatus,
   alreadyMembersText,
   contextLine,
   invitedText,
   peopleText,
   resultTitle,
   sendLabel,
   serversText,
   stepAnnouncement,
   unemailedAddresses,
   unemailedText,
   wizardSteps,
};
export type { StatusTone, StepId };
