import { useRouter } from "next/router";
import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useRef,
   useState,
   type ReactNode,
} from "react";
import {
   SEQUENCE_WINDOW_MS,
   chordSequence,
   eventToken,
   isOverlayOpen,
   isTypingTarget,
   matchShortcut,
   startsSequence,
   type Shortcut,
} from "./registry";

/**
 * A registration is a live box around a shortcut. Components re-render often
 * and their handlers close over fresh state, so the registry holds the box
 * and reads `.current` at keypress time instead of re-registering.
 */
type Registration = { current: Shortcut };

type ShortcutsValue = {
   /** Registers a shortcut until the returned cleanup runs. */
   register: (entry: Registration) => () => void;
   /** Every shortcut currently registered, page ones before the globals. */
   list: () => Shortcut[];
   /** Bumps whenever a shortcut is registered or unregistered. */
   getVersion: () => number;
   /** Calls `listener` on every registry change; returns an unsubscribe. */
   subscribe: (listener: () => void) => () => void;
   helpOpen: boolean;
   setHelpOpen: (open: boolean) => void;
};

const ShortcutsContext = createContext<ShortcutsValue | null>(null);

/**
 * App-wide keyboard shortcuts. Components register their own bindings with
 * `useShortcut` while they are mounted, so the help dialog always lists what
 * actually works on the page you are looking at.
 */
const ShortcutsProvider = ({ children }: { children: ReactNode }) => {
   const router = useRouter();
   const [helpOpen, setHelpOpen] = useState(false);
   const entries = useRef<Set<Registration>>(new Set());
   /** The armed half of a two-key sequence, e.g. the `g` of `g d`. */
   const pending = useRef<{ token: string; at: number } | null>(null);
   // The registry lives in refs so registering never re-renders the app. The
   // help dialog is the one thing that needs to know it changed, so it
   // subscribes here instead.
   const version = useRef(0);
   const listeners = useRef<Set<() => void>>(new Set());

   const emit = useCallback(() => {
      version.current += 1;
      listeners.current.forEach((listener) => listener());
   }, []);

   const register = useCallback(
      (entry: Registration) => {
         entries.current.add(entry);
         emit();
         return () => {
            entries.current.delete(entry);
            emit();
         };
      },
      [emit]
   );

   const getVersion = useCallback(() => version.current, []);

   const subscribe = useCallback((listener: () => void) => {
      listeners.current.add(listener);
      return () => {
         listeners.current.delete(listener);
      };
   }, []);

   // Re-navigating to the page you are already on would remount it and throw
   // away scroll and grid state for nothing.
   const go = useCallback(
      (href: string) => {
         if (router.pathname !== href) void router.push(href);
      },
      [router]
   );

   const globals = useMemo<Shortcut[]>(
      () => [
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
            handler: () => go("/dashboard"),
         },
         {
            keys: "g s",
            label: "Go to settings",
            group: "Navigation",
            handler: () => go("/settings/profile"),
         },
      ],
      [go]
   );

   // Page shortcuts come first so a page can shadow a global binding.
   const list = useCallback(
      () => [
         ...Array.from(entries.current, (entry) => entry.current),
         ...globals,
      ],
      [globals]
   );

   useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
         // A held key must not fire an action over and over, and an IME
         // composition is text entry however it reaches us.
         if (event.repeat || event.isComposing) return;

         // A modifier is held: this is never part of a sequence being typed
         // (⌘G is not the `g` of `g d`), and the only thing it may run is a
         // `mod` chord somebody registered on purpose. Everything else —
         // ⌥, ⇧-chords, ⌘ combos we do not know — stays the browser's.
         if (event.metaKey || event.ctrlKey || event.altKey) {
            pending.current = null;
            if (event.altKey || event.shiftKey) return;
            if (isTypingTarget(event.target) || isOverlayOpen()) return;
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
   }, [list]);

   const value = useMemo<ShortcutsValue>(
      () => ({ register, list, getVersion, subscribe, helpOpen, setHelpOpen }),
      [register, list, getVersion, subscribe, helpOpen]
   );

   return (
      <ShortcutsContext.Provider value={value}>
         {children}
      </ShortcutsContext.Provider>
   );
};

const useShortcutsContext = (): ShortcutsValue => {
   const context = useContext(ShortcutsContext);
   if (!context)
      throw new Error(
         "useShortcutsContext must be used within a ShortcutsProvider"
      );
   return context;
};

export { ShortcutsProvider, useShortcutsContext };
export type { Registration };
