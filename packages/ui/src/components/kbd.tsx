import { cn } from "@s3-viewer/ui/lib/utils";
import { useSyncExternalStore, type HTMLAttributes } from "react";

const GLYPHS: Record<string, string> = {
   cmd: "⌘",
   shift: "⇧",
   alt: "⌥",
   enter: "↵",
   esc: "Esc",
   up: "↑",
   down: "↓",
   left: "←",
   right: "→",
   backspace: "⌫",
   delete: "⌦",
};

/**
 * `mod` is ⌘ on Apple hardware and Ctrl everywhere else. The check has to run
 * on the client, so it goes through `useSyncExternalStore`: the server
 * snapshot is also what React uses while hydrating, which keeps the first
 * client render identical to the HTML and defaults to ⌘.
 */
const NEVER_CHANGES = () => () => {};

const readIsApple = (): boolean =>
   /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

const assumeApple = (): boolean => true;

const useModGlyph = (): string =>
   useSyncExternalStore(NEVER_CHANGES, readIsApple, assumeApple) ? "⌘" : "Ctrl";

type KbdProps = HTMLAttributes<HTMLElement> & {
   /** Space or "+" separated keys, e.g. "mod k", "shift ?", "/" */
   keys: string;
};

/** Renders a keyboard shortcut as a row of key caps. */
const Kbd = ({ keys, className, ...props }: KbdProps) => {
   const mod = useModGlyph();

   return (
      <span
         className={cn("inline-flex items-center gap-0.5", className)}
         aria-label={keys}
         {...props}
      >
         {keys
            .trim()
            .split(/[\s+]+/)
            .filter(Boolean)
            .map((token, index) => {
               const key = token.toLowerCase();
               return (
                  <kbd
                     key={index}
                     className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-viewerborder bg-viewerwhite px-1 font-sans text-[11px] font-medium leading-none text-viewertext"
                  >
                     {key === "mod"
                        ? mod
                        : (GLYPHS[key] ?? token.toUpperCase())}
                  </kbd>
               );
            })}
      </span>
   );
};

export { Kbd };
