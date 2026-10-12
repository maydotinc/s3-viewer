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

const NEVER_CHANGES = () => () => {};

const readIsApple = (): boolean =>
   /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

const assumeApple = (): boolean => true;

const useModGlyph = (): string =>
   useSyncExternalStore(NEVER_CHANGES, readIsApple, assumeApple) ? "⌘" : "Ctrl";

type KbdProps = HTMLAttributes<HTMLElement> & {
   keys: string;
};

const Kbd = ({ keys, className, ...props }: KbdProps) => {
   const mod = useModGlyph();

   return (
      <span
         className={cn(
            "inline-flex items-center gap-0.5 pointer-coarse:hidden",
            className
         )}
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
                     className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-viewerborder bg-viewerwhite px-1 font-sans text-[11px] font-medium leading-none text-viewertext",
                        key === "mod" && "w-8 shrink-0"
                     )}
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
