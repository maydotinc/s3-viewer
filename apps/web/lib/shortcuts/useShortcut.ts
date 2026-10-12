import { useEffect, useRef } from "react";
import { useShortcutRegistry } from "./provider";
import type { Shortcut } from "./registry";

const useShortcut = (shortcut: Shortcut): void => {
   const { register } = useShortcutRegistry();
   const entry = useRef(shortcut);

   useEffect(() => {
      entry.current = shortcut;
   });

   useEffect(() => register(entry), [register]);
};

export { useShortcut };
