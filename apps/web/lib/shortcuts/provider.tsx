import { isTypingTarget } from "@/lib/utils/dom";
import { SITE_PATHS } from "@s3-viewer/shared";
import { useRouter, type NextRouter } from "next/router";
import {
   createContext,
   useContext,
   useEffect,
   useMemo,
   useRef,
   useState,
   type ReactNode,
   type RefObject,
} from "react";
import {
   SEQUENCE_WINDOW_MS,
   chordSequence,
   eventToken,
   isOverlayOpen,
   matchShortcut,
   startsSequence,
   type Shortcut,
} from "./registry";

type Registration = { current: Shortcut };

type ShortcutRegistry = {
   register: (entry: Registration) => () => void;
   list: () => Shortcut[];
   getVersion: () => number;
   subscribe: (listener: () => void) => () => void;
   setHelpOpen: (open: boolean) => void;
};

type ShortcutsValue = ShortcutRegistry & { helpOpen: boolean };

const RegistryContext = createContext<ShortcutRegistry | null>(null);
const HelpOpenContext = createContext(false);

const createRegistry = (
   router: RefObject<NextRouter>,
   setHelpOpen: (open: boolean) => void
): ShortcutRegistry => {
   const entries = new Set<Registration>();
   const listeners = new Set<() => void>();
   let version = 0;

   const emit = () => {
      version += 1;
      listeners.forEach((listener) => listener());
   };

   const go = (href: string) => {
      if (router.current.pathname !== href) void router.current.push(href);
   };

   const globals: Shortcut[] = [
      {
         keys: "?",
         label: "Show keyboard shortcuts",
         group: "Navigation",
         handler: () => setHelpOpen(true),
      },
      {
         keys: "g d",
         label: "Go to dashboard",
         group: "Navigation",
         handler: () => go(SITE_PATHS.dashboard),
      },
      {
         keys: "g s",
         label: "Go to settings",
         group: "Navigation",
         handler: () => go(SITE_PATHS.settingsProfile),
      },
   ];

   return {
      register: (entry) => {
         entries.add(entry);
         emit();
         return () => {
            entries.delete(entry);
            emit();
         };
      },
      list: () => [
         ...Array.from(entries, (entry) => entry.current),
         ...globals,
      ],
      getVersion: () => version,
      subscribe: (listener) => {
         listeners.add(listener);
         return () => {
            listeners.delete(listener);
         };
      },
      setHelpOpen,
   };
};

const ShortcutsProvider = ({ children }: { children: ReactNode }) => {
   const router = useRouter();
   const routerRef = useRef(router);
   const [helpOpen, setHelpOpen] = useState(false);
   const [registry] = useState(() => createRegistry(routerRef, setHelpOpen));
   const pending = useRef<{ token: string; at: number } | null>(null);

   useEffect(() => {
      routerRef.current = router;
   });

   useEffect(() => {
      const { list } = registry;
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.repeat || event.isComposing) return;

         if (event.metaKey || event.ctrlKey || event.altKey) {
            pending.current = null;
            if (event.altKey || event.shiftKey) return;
            if (isOverlayOpen()) return;
            const chordToken = eventToken(event);
            if (!chordToken) return;
            const chord = matchShortcut(list(), chordSequence(chordToken));
            if (!chord) return;
            event.preventDefault();
            chord.handler();
            return;
         }

         if (isTypingTarget(event.target)) return;
         if (isOverlayOpen()) return;

         const token = eventToken(event);
         if (!token) return;

         const shortcuts = list();
         const armed = pending.current;
         pending.current = null;

         if (armed && Date.now() - armed.at < SEQUENCE_WINDOW_MS) {
            const sequenced = matchShortcut(
               shortcuts,
               `${armed.token} ${token}`
            );
            if (sequenced) {
               event.preventDefault();
               sequenced.handler();
               return;
            }
         }

         const single = matchShortcut(shortcuts, token);
         if (single) {
            event.preventDefault();
            single.handler();
            return;
         }

         if (startsSequence(shortcuts, token)) {
            event.preventDefault();
            pending.current = { token, at: Date.now() };
         }
      };

      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
   }, [registry]);

   return (
      <RegistryContext.Provider value={registry}>
         <HelpOpenContext.Provider value={helpOpen}>
            {children}
         </HelpOpenContext.Provider>
      </RegistryContext.Provider>
   );
};

const useShortcutRegistry = (): ShortcutRegistry => {
   const registry = useContext(RegistryContext);
   if (!registry)
      throw new Error(
         "useShortcutRegistry must be used within a ShortcutsProvider"
      );
   return registry;
};

const useShortcutsContext = (): ShortcutsValue => {
   const registry = useShortcutRegistry();
   const helpOpen = useContext(HelpOpenContext);
   return useMemo(() => ({ ...registry, helpOpen }), [registry, helpOpen]);
};

export { ShortcutsProvider, useShortcutRegistry, useShortcutsContext };
