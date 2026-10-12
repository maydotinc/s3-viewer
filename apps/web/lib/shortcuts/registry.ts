const SHORTCUT_GROUPS = ["Navigation", "Buckets", "Objects"] as const;

type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

type Shortcut = {
   keys: string;
   label: string;
   group: ShortcutGroup;
   handler: () => void;
   when?: () => boolean;
   aliases?: string[];
};

const SEQUENCE_WINDOW_MS = 1000;

const MOD = "mod";

const chordSequence = (token: string): string => `${MOD} ${token}`;

const NAMED_KEYS: Record<string, string> = {
   ArrowDown: "down",
   ArrowLeft: "left",
   ArrowRight: "right",
   ArrowUp: "up",
   Backspace: "backspace",
   Delete: "delete",
   Enter: "enter",
};

const eventToken = (event: KeyboardEvent): string | null => {
   if (event.key.length === 1)
      return event.key === " " ? null : event.key.toLowerCase();
   return NAMED_KEYS[event.key] ?? null;
};

const isOverlayOpen = (): boolean =>
   document.querySelector(
      "[role=dialog],[role=alertdialog],[role=menu],[role=listbox]"
   ) !== null;

const tokensOf = (shortcut: Shortcut): string[] => [
   shortcut.keys,
   ...(shortcut.aliases ?? []),
];

const isEnabled = (shortcut: Shortcut): boolean => shortcut.when?.() !== false;

const matchShortcut = (
   shortcuts: readonly Shortcut[],
   sequence: string
): Shortcut | null =>
   shortcuts.find(
      (shortcut) => isEnabled(shortcut) && tokensOf(shortcut).includes(sequence)
   ) ?? null;

const startsSequence = (
   shortcuts: readonly Shortcut[],
   token: string
): boolean =>
   shortcuts.some(
      (shortcut) =>
         isEnabled(shortcut) &&
         tokensOf(shortcut).some((keys) => keys.startsWith(`${token} `))
   );

const groupShortcuts = (
   shortcuts: readonly Shortcut[]
): { group: ShortcutGroup; items: Shortcut[] }[] =>
   SHORTCUT_GROUPS.map((group) => ({
      group,
      items: shortcuts.filter(
         (shortcut, index) =>
            shortcut.group === group &&
            isEnabled(shortcut) &&
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
   matchShortcut,
   startsSequence,
};
export type { Shortcut, ShortcutGroup };
