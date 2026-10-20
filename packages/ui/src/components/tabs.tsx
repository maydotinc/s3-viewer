import * as React from "react";

import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";

const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
   const target = event.target;
   if (
      !(target instanceof HTMLElement) ||
      target.getAttribute("role") !== "tab"
   )
      return;
   const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')
   );
   const index = tabs.indexOf(target);
   const next =
      event.key === "ArrowRight"
         ? tabs[(index + 1) % tabs.length]
         : event.key === "ArrowLeft"
           ? tabs[(index - 1 + tabs.length) % tabs.length]
           : event.key === "Home"
             ? tabs[0]
             : event.key === "End"
               ? tabs[tabs.length - 1]
               : undefined;
   if (!next) return;
   event.preventDefault();
   next.focus();
   next.click();
};

function TabList({
   className,
   children,
   ...props
}: React.ComponentProps<"div">) {
   return (
      <div
         role="tablist"
         className={cn(
            "inline-flex h-9 max-w-full w-fit shrink-0 items-center gap-1 overflow-x-auto rounded-lg bg-viewergray p-1 [scrollbar-width:none] pointer-coarse:h-12",
            className
         )}
         onKeyDown={moveFocus}
         {...props}
      >
         {children}
      </div>
   );
}

const ITEM =
   "inline-flex h-7 shrink-0 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none select-none transition-colors duration-150 pointer-coarse:h-10";

type TabItemProps = {
   active: boolean;
   count?: number | null;
   children: React.ReactNode;
};

function TabButton({
   active,
   count,
   className,
   children,
   ...props
}: TabItemProps & Omit<React.ComponentProps<"button">, "children">) {
   return (
      <button
         type="button"
         role="tab"
         data-state={active ? "active" : "inactive"}
         aria-selected={active}
         className={cn(
            ITEM,
            FOCUS_RING,
            active
               ? "bg-viewerwhite text-viewerblack shadow-sm"
               : "text-viewertext hover:text-viewerblack",
            className
         )}
         {...props}
      >
         <span>{children}</span>
         {count !== undefined && (
            <span
               className={cn(
                  "min-w-[2ch] text-center text-xs tabular-nums",
                  active ? "text-viewertext" : "text-viewerlighttext"
               )}
            >
               {count ?? " "}
            </span>
         )}
      </button>
   );
}

export { TabButton, TabList };
