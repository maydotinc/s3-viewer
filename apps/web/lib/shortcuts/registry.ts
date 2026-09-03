/**
 * The pure half of the keyboard-shortcut system: what a shortcut is, how a
 * key event turns into a token, and which registered shortcut a token (or a
 * two-key sequence) matches. No React, so it stays easy to reason about.
 */

/** Help-dialog sections, in the order they are shown. */
const SHORTCUT_GROUPS = ["Navigation", "Buckets", "Objects"] as const;

type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

type Shortcut = {
   /**
    * Canonical key string, also what the help dialog and tooltips render:
    * a single token (`"/"`, `"n"`, `"delete"`), a two-key sequence pressed one
    * after the other (`"g d"`), or a `mod` chord held together (`"mod b"`).
    */
   keys: string;
   /** Sentence-case description, e.g. "Filter buckets". */
   label: string;
   group: ShortcutGroup;
   handler: () => void;
   /** Inert and hidden from the help dialog while this returns false. */
   when?: () => boolean;
   /** Extra key strings that fire the same handler; never displayed. */
   aliases?: string[];
};

/** How long a sequence prefix such as `g` stays armed. */
const SEQUENCE_WINDOW_MS = 1000;

/**
 * The platform-agnostic name for ⌘ on Apple hardware and Ctrl elsewhere. A
 * shortcut whose `keys` start with it — `"mod b"` — is a chord held together,
 * not the two-key sequence `"g d"` is. No key event ever produces the token
 * `mod`, so a chord can never be reached down the sequence path.
 */
const MOD = "mod";

/** The sequence string a `mod`-chord on `token` is registered under. */
const chordSequence = (token: string): string => `${MOD} ${token}`;

/** Multi-character `KeyboardEvent.key` values we accept, mapped to tokens. */
const NAMED_KEYS: Record<string, string> = {
   ArrowDown: "down",
   ArrowLeft: "left",
   ArrowRight: "right",
   ArrowUp: "up",
   Backspace: "backspace",
   Delete: "delete",
   Enter: "enter",
};

/**
 * The token a key event contributes to a sequence, or null when the key is
 * not one we ever bind (modifiers, F-keys, Escape — which is Radix's).
 */
const eventToken = (event: KeyboardEvent): string | null => {
   if (event.key.length === 1)
      return event.key === " " ? null : event.key.toLowerCase();
   return NAMED_KEYS[event.key] ?? null;
};

/** Anywhere text goes swallows every shortcut. */
const isTypingTarget = (target: EventTarget | null): boolean => {
   if (!(target instanceof HTMLElement)) return false;
   if (target.isContentEditable) return true;
   const tag = target.tagName;
   if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
   // A combobox trigger runs its own typeahead, and the event can land on a
   // span inside it rather than on the trigger itself.
   return target.closest("[role=combobox]") !== null;
};

/**
 * An open dialog, menu or listbox owns the keyboard: it has its own
 * arrow/typeahead behaviour, and Escape closing it is Radix's job, not ours.
 */
const isOverlayOpen = (): boolean =>
   document.querySelector(
      "[role=dialog],[role=alertdialog],[role=menu],[role=listbox]"
   ) !== null;

const tokensOf = (shortcut: Shortcut): string[] => [
   shortcut.keys,
   ...(shortcut.aliases ?? []),
];

const isEnabled = (shortcut: Shortcut): boolean => shortcut.when?.() !== false;

/** The enabled shortcut bound to `sequence`, if any. */
const matchShortcut = (
   shortcuts: readonly Shortcut[],
   sequence: string
): Shortcut | null =>
   shortcuts.find(
      (shortcut) => isEnabled(shortcut) && tokensOf(shortcut).includes(sequence)
   ) ?? null;

/** True when `token` starts a two-key sequence worth waiting on. */
const startsSequence = (
   shortcuts: readonly Shortcut[],
   token: string
): boolean =>
   shortcuts.some(
      (shortcut) =>
         isEnabled(shortcut) &&
         tokensOf(shortcut).some((keys) => keys.startsWith(`${token} `))
   );

/** Enabled shortcuts bucketed into the help dialog's sections, in order. */
const groupShortcuts = (
   shortcuts: readonly Shortcut[]
): { group: ShortcutGroup; items: Shortcut[] }[] =>
   SHORTCUT_GROUPS.map((group) => ({
      group,
      items: shortcuts.filter(
         (shortcut, index) =>
            shortcut.group === group &&
            isEnabled(shortcut) &&
            // The same binding can be registered by two mounted components
            // (a page and its toolbar); show it once.
            shortcuts.findIndex(
               (other) =>
                  other.group === group &&
                  other.keys === shortcut.keys &&
                  other.label === shortcut.label
            ) === index
      ),
   })).filter((section) => section.items.length > 0);

export {
   SEQUENCE_WINDOW_MS,
   chordSequence,
   eventToken,
   groupShortcuts,
   isOverlayOpen,
   isTypingTarget,
   matchShortcut,
   startsSequence,
};
export type { Shortcut, ShortcutGroup };
