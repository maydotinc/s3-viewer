import {
   groupShortcuts,
   useShortcutsContext,
   type Shortcut,
   type ShortcutGroup,
} from "@/lib/shortcuts";
import {
   Dialog,
   DialogBody,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { useSyncExternalStore } from "react";

/**
 * Keys the app does not own but every user should know about. Escape is
 * Radix's, so there is nothing to register — it is listed, not bound.
 */
const UNBOUND: { keys: string; label: string; group: ShortcutGroup }[] = [
   { keys: "esc", label: "Close a dialog or menu", group: "Navigation" },
];

const ShortcutRow = ({ keys, label }: { keys: string; label: string }) => (
   <li className="flex h-7 items-center justify-between gap-4">
      <span className="min-w-0 truncate text-sm text-viewertext">{label}</span>
      <Kbd keys={keys} className="shrink-0" />
   </li>
);

/**
 * The `?` cheatsheet. It lists what is registered right now, so the rows
 * follow the page you opened it from.
 */
const ShortcutsHelp = () => {
   const { helpOpen, setHelpOpen, list, getVersion, subscribe } =
      useShortcutsContext();

   // Re-render whenever something registers or unregisters, so a dialog left
   // open across a navigation still lists the page you are on.
   useSyncExternalStore(subscribe, getVersion, getVersion);

   // Deliberately not memoised: `when()` is evaluated fresh on every render,
   // and this list is at most a few dozen rows.
   const shortcuts: Shortcut[] = helpOpen
      ? [...list(), ...UNBOUND.map((hint) => ({ ...hint, handler: () => {} }))]
      : [];
   const sections = groupShortcuts(shortcuts);

   return (
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
         <DialogContent className="max-w-lg">
            <DialogHeader>
               <DialogTitle>Keyboard shortcuts</DialogTitle>
               <DialogDescription>
                  Press ? anywhere outside a text field to open this list.
               </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-6">
               {sections.map((section) => (
                  <div key={section.group}>
                     <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-viewerlighttext">
                        {section.group}
                     </h3>
                     <ul className="flex flex-col">
                        {section.items.map((shortcut) => (
                           <ShortcutRow
                              key={`${shortcut.keys}-${shortcut.label}`}
                              keys={shortcut.keys}
                              label={shortcut.label}
                           />
                        ))}
                     </ul>
                  </div>
               ))}
            </DialogBody>
         </DialogContent>
      </Dialog>
   );
};

export default ShortcutsHelp;
