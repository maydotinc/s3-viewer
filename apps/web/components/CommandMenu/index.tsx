import { flatten, rankCommands } from "@/lib/command-menu/rank";
import useCommandMenuStore from "@/lib/command-menu/store";
import type { CommandItem } from "@/lib/command-menu/types";
import useCommands from "@/lib/command-menu/useCommands";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { useShortcut } from "@/lib/shortcuts";
import {
   Dialog,
   DialogContent,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { Search, SearchX } from "lucide-react";
import { useRouter } from "next/router";
import {
   useCallback,
   useEffect,
   useId,
   useMemo,
   useRef,
   useState,
   type KeyboardEvent,
} from "react";
import CommandRow from "./row";

const HINTS = [
   { keys: "up down", label: "Navigate" },
   { keys: "enter", label: "Open" },
   { keys: "esc", label: "Close" },
];

const HEADING =
   "px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-viewerlighttext uppercase";

const CommandMenuDialog = () => {
   const router = useRouter();
   const closeMenu = useCommandMenuStore((state) => state.closeMenu);
   const remember = useCommandMenuStore((state) => state.remember);
   const recentIds = useCommandMenuStore((state) => state.recentIds);
   const commands = useCommands();

   const [query, setQuery] = useState("");
   const [activeIndex, setActiveIndex] = useState(0);
   const inputRef = useRef<HTMLInputElement>(null);
   const activeNode = useRef<HTMLElement | null>(null);
   const setActiveNode = useCallback((node: HTMLElement | null) => {
      activeNode.current = node;
   }, []);
   const scope = useId();
   const listId = `${scope}-list`;
   const optionId = (id: string) => `${scope}-${id}`;

   const groups = useMemo(
      () => rankCommands(commands, query, recentIds),
      [commands, query, recentIds]
   );
   const flat = useMemo(() => flatten(groups), [groups]);
   const indexOf = useMemo(
      () => new Map(flat.map((command, index) => [command.id, index])),
      [flat]
   );
   // clamped at read time rather than by an effect, so a list that shrinks
   // while you type keeps a valid selection with no extra render.
   const active = Math.min(activeIndex, Math.max(0, flat.length - 1));
   const activeCommand = flat[active];

   useEffect(() => {
      activeNode.current?.scrollIntoView({ block: "nearest" });
   }, [activeCommand?.id]);

   const select = useCallback(
      (command: CommandItem) => {
         remember(command.id);
         closeMenu();
         if (command.href) void router.push(command.href);
         else command.run?.();
      },
      [closeMenu, remember, router]
   );

   const step = (delta: number) => {
      if (flat.length === 0) return;
      setActiveIndex((active + delta + flat.length) % flat.length);
   };

   const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
         event.preventDefault();
         closeMenu();
         return;
      }
      if (event.key === "ArrowDown") {
         event.preventDefault();
         step(1);
         return;
      }
      if (event.key === "ArrowUp") {
         event.preventDefault();
         step(-1);
         return;
      }
      if (event.key === "Enter" && activeCommand) {
         event.preventDefault();
         select(activeCommand);
      }
   };

   return (
      <Dialog open onOpenChange={closeMenu}>
         <DialogContent
            showCloseButton={false}
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
               event.preventDefault();
               inputRef.current?.focus();
            }}
            className="top-[8vh] max-h-[80dvh] max-w-xl translate-y-0 sm:top-[12vh] sm:max-h-[70dvh] lg:max-w-2xl"
         >
            <DialogTitle className="sr-only">Command menu</DialogTitle>
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-viewerborder px-4">
               <Search
                  aria-hidden="true"
                  className="size-4 shrink-0 text-viewerlighttext"
               />
               <input
                  ref={inputRef}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-label="Search buckets, pages and actions"
                  aria-activedescendant={
                     activeCommand ? optionId(activeCommand.id) : undefined
                  }
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Search buckets and commands…"
                  value={query}
                  onChange={(event) => {
                     setQuery(event.target.value);
                     setActiveIndex(0);
                  }}
                  onKeyDown={onKeyDown}
                  className="h-14 min-w-0 flex-1 bg-transparent text-base text-viewerblack outline-none placeholder:text-viewerlighttext sm:text-sm"
               />
               <Kbd keys="esc" className="hidden shrink-0 sm:inline-flex" />
            </div>

            <div
               id={listId}
               role="listbox"
               aria-label="Results"
               className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
            >
               {flat.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
                     <span className="flex size-10 items-center justify-center rounded-lg bg-viewergray">
                        <SearchX
                           aria-hidden="true"
                           className="size-5 text-viewerlighttext"
                        />
                     </span>
                     <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-viewerblack">
                           No matches for “{query.trim()}”
                        </p>
                        <p className="text-sm text-viewertext">
                           Try a bucket name, a page, or an action.
                        </p>
                     </div>
                  </div>
               ) : (
                  groups.map((group) => (
                     <div
                        key={group.group}
                        role="group"
                        aria-label={group.group}
                     >
                        <p className={HEADING}>{group.group}</p>
                        <div className="flex flex-col gap-0.5">
                           {group.items.map(({ command, ranges }) => {
                              const index = indexOf.get(command.id) ?? -1;
                              const isActive = index === active;
                              return (
                                 <CommandRow
                                    key={command.id}
                                    command={command}
                                    ranges={ranges}
                                    active={isActive}
                                    optionId={optionId(command.id)}
                                    nodeRef={
                                       isActive ? setActiveNode : undefined
                                    }
                                    onHover={() => setActiveIndex(index)}
                                    onSelect={() => select(command)}
                                 />
                              );
                           })}
                        </div>
                     </div>
                  ))
               )}
            </div>

            <div
               aria-hidden="true"
               className="hidden shrink-0 select-none items-center gap-4 border-t border-viewerborder px-4 py-2.5 text-xs text-viewerlighttext sm:flex"
            >
               {HINTS.map((hint) => (
                  <span key={hint.label} className="flex items-center gap-1.5">
                     <Kbd keys={hint.keys} />
                     {hint.label}
                  </span>
               ))}
            </div>
         </DialogContent>
      </Dialog>
   );
};

const CommandMenu = () => {
   const open = useCommandMenuStore((state) => state.open);
   const openMenu = useCommandMenuStore((state) => state.openMenu);
   const signedIn = useSessionState() === "signedIn";

   useShortcut({
      keys: "mod k",
      label: "Search",
      group: "Navigation",
      when: () => signedIn,
      handler: openMenu,
   });

   // unmounted while closed, so query, selection and recents reset on open.
   return open && signedIn ? <CommandMenuDialog /> : null;
};

export default CommandMenu;
