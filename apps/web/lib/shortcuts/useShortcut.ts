import { useEffect, useRef } from "react";
import { useShortcutsContext } from "./provider";
import type { Shortcut } from "./registry";

const useShortcut = (shortcut: Shortcut): void => {
   const { register } = useShortcutsContext();
   const entry = useRef(shortcut);

   useEffect(() => {
      entry.current = shortcut;
   });

   useEffect(() => register(entry), [register]);
};

const TOOLBAR_DEPTH = 4;

// the filter and the actions share a toolbar row but sit in different
// components, and the filter is not always ours to hand a ref to — so widen
// the search one ancestor at a time and take the nearest text input.
const focusToolbarFilter = (from: HTMLElement | null): void => {
   let scope = from?.parentElement ?? null;
   for (let depth = 0; scope && depth < TOOLBAR_DEPTH; depth += 1) {
      const input = scope.querySelector<HTMLInputElement>('input[type="text"]');
      if (input) {
         input.focus();
         input.select();
         return;
      }
      scope = scope.parentElement;
   }
};

export { focusToolbarFilter, useShortcut };
