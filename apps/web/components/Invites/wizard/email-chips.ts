import { splitList } from "@/lib/utils/split-list";
import {
   MAX_INVITE_EMAILS,
   emailSchema,
   normalizeEmail,
} from "@s3-viewer/types";
import type { Message } from "../message";

type EmailField = {
   chips: string[];
   input: string;
   // transient message from the last action; cleared by the next edit
   feedback: Message | null;
};

const EMPTY_EMAIL_FIELD: EmailField = { chips: [], input: "", feedback: null };

const TOO_MANY_EMAILS = `You can invite up to ${MAX_INVITE_EMAILS} people at a time`;
const INVALID_EMAILS = "Check the highlighted addresses";
const NO_EMAILS = "Enter at least one email address";
const EMAIL_HINT = "Press Enter after each address, or paste a list.";
const INVALID_CHIP_TITLE = "Not a valid email address";

const isValidEmail = (email: string): boolean =>
   emailSchema.safeParse(email).success;

const splitEmails = (raw: string): string[] => [
   ...new Set(splitList(raw, /[\s,;]+/).map(normalizeEmail)),
];

const addEmails = (field: EmailField, raw: string): EmailField => {
   const chips = [...field.chips];
   const leftover: string[] = [];
   let duplicate: string | null = null;
   for (const email of splitEmails(raw)) {
      if (chips.includes(email)) duplicate = email;
      else if (chips.length >= MAX_INVITE_EMAILS) leftover.push(email);
      else chips.push(email);
   }
   if (leftover.length > 0)
      return {
         chips,
         input: leftover.join(", "),
         feedback: { tone: "error", text: TOO_MANY_EMAILS },
      };
   return {
      chips,
      input: "",
      feedback: duplicate
         ? { tone: "notice", text: `${duplicate} is already in the list` }
         : null,
   };
};

const commitInput = (field: EmailField): EmailField =>
   field.input.trim() ? addEmails(field, field.input) : field;

const setInput = (field: EmailField, input: string): EmailField => ({
   ...field,
   input,
   feedback: null,
});

const removeChip = (field: EmailField, email: string): EmailField => ({
   ...field,
   chips: field.chips.filter((chip) => chip !== email),
   feedback: null,
});

const popChip = (field: EmailField): EmailField => {
   const last = field.chips.at(-1);
   if (field.input !== "" || last === undefined) return field;
   return { chips: field.chips.slice(0, -1), input: last, feedback: null };
};

const requireEmails = (field: EmailField): EmailField => ({
   ...field,
   feedback: { tone: "error", text: NO_EMAILS },
});

const hasInvalidChip = (field: EmailField): boolean =>
   field.chips.some((chip) => !isValidEmail(chip));

const helperMessage = (field: EmailField): Message => {
   if (field.feedback?.tone === "error") return field.feedback;
   if (hasInvalidChip(field)) return { tone: "error", text: INVALID_EMAILS };
   return field.feedback ?? { tone: "notice", text: EMAIL_HINT };
};

const canContinue = ({ chips, input }: EmailField): boolean => {
   if (
      chips.length === 0 ||
      chips.length > MAX_INVITE_EMAILS ||
      chips.some((chip) => !isValidEmail(chip))
   )
      return false;
   const typed = splitEmails(input);
   if (typed.length === 0) return true;
   if (!typed.every(isValidEmail)) return false;
   const fresh = typed.filter((email) => !chips.includes(email));
   return chips.length + fresh.length <= MAX_INVITE_EMAILS;
};

export {
   EMPTY_EMAIL_FIELD,
   INVALID_CHIP_TITLE,
   addEmails,
   canContinue,
   commitInput,
   helperMessage,
   isValidEmail,
   popChip,
   removeChip,
   requireEmails,
   setInput,
};
export type { EmailField };
