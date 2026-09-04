import { useEffect, useRef } from "react";
import { useShortcutsContext } from "./provider";
import type { Shortcut } from "./registry";

/**
 * Binds a keyboard shortcut for as long as the component is mounted, and lists
 * it in the `?` dialog. Pass a `when` predicate rather than calling this
 * conditionally — the shortcut goes inert and drops out of the dialog while it
 * returns false.
 */
const useShortcut = (shortcut: Shortcut): void => {
   const { register } = useShortcutsContext();
   const entry = useRef(shortcut);

   // Keep the handler and its closed-over state fresh without re-registering.
   useEffect(() => {
      entry.current = shortcut;
   });

   useEffect(() => register(entry), [register]);
};

const TOOLBAR_DEPTH = 4;

/**
 * Focuses the filter input of the toolbar row `from` sits in. A toolbar puts
 * the filter and the actions on one row but in different components, and the
 * filter is not always ours to hand a ref to — so widen the search one
 * ancestor at a time and take the nearest text input.
 */
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
