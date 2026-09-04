import { segmentText, type Range } from "@/lib/command-menu/match";
import type { CommandItem } from "@/lib/command-menu/types";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { cn } from "@s3-viewer/ui/lib/utils";
import Link from "next/link";
import type { MouseEvent } from "react";

const ROW =
   "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-150 [&_svg]:size-4 [&_svg]:shrink-0";

const isModifiedClick = (event: MouseEvent): boolean =>
   event.metaKey ||
   event.ctrlKey ||
   event.shiftKey ||
   event.altKey ||
   event.button !== 0;

type RowProps = {
   command: CommandItem;
   ranges: readonly Range[];
   active: boolean;
   optionId: string;
   nodeRef?: (node: HTMLElement | null) => void;
   onHover: () => void;
   onSelect: () => void;
};

const CommandRow = ({
   command,
   ranges,
   active,
   optionId,
   nodeRef,
   onHover,
   onSelect,
}: RowProps) => {
   const { icon: Icon, destructive } = command;

   const shared = {
      id: optionId,
      role: "option",
      "aria-selected": active,
      tabIndex: -1,
      onMouseMove: onHover,
      className: cn(
         ROW,
         destructive
            ? "text-viewertextred [&_svg]:text-viewertextred"
            : "text-viewerblack [&_svg]:text-viewertext",
         active && (destructive ? "bg-viewerbgred" : "bg-viewergray")
      ),
   } as const;

   const body = (
      <>
         <Icon aria-hidden="true" />
         <span className="flex min-w-0 flex-1 flex-col">
            <span className="min-w-0 truncate text-sm">
               {segmentText(command.label, ranges).map((segment, index) =>
                  segment.matched ? (
                     <mark
                        key={index}
                        className="bg-transparent font-semibold text-viewerblue"
                     >
                        {segment.text}
                     </mark>
                  ) : (
                     <span key={index}>{segment.text}</span>
                  )
               )}
            </span>
            {command.description && (
               <span className="min-w-0 truncate text-xs text-viewertext">
                  {command.description}
               </span>
            )}
         </span>
         {command.trailing && (
            <span className="shrink-0 text-xs text-viewerlighttext">
               {command.trailing}
            </span>
         )}
         {command.shortcut && (
            <Kbd keys={command.shortcut} className="shrink-0" />
         )}
      </>
   );

   // A navigating row is a real anchor, so Next prefetches it and ⌘-click
   // still opens a tab; an unmodified click goes through `onSelect` like Enter.
   return command.href ? (
      <Link
         {...shared}
         ref={nodeRef}
         href={command.href}
         onClick={(event) => {
            if (isModifiedClick(event)) return;
            event.preventDefault();
            onSelect();
         }}
      >
         {body}
      </Link>
   ) : (
      <button {...shared} ref={nodeRef} type="button" onClick={onSelect}>
         {body}
      </button>
   );
};

export default CommandRow;
