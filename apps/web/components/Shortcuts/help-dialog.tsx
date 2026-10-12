import SectionLabel from "@/components/section-label";
import {
   groupShortcuts,
   useShortcutRegistry,
   useShortcutsContext,
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

const UNBOUND: { keys: string; label: string; group: ShortcutGroup }[] = [
   { keys: "esc", label: "Close a dialog or menu", group: "Navigation" },
];

const ShortcutRow = ({ keys, label }: { keys: string; label: string }) => (
   <li className="flex h-7 items-center justify-between gap-4">
      <span className="min-w-0 truncate text-sm text-viewertext">{label}</span>
      {/* Kbd hides on touch, but this list is useless without its keys. */}
      <Kbd keys={keys} className="shrink-0 pointer-coarse:inline-flex" />
   </li>
);

// mounted only while the dialog content is, so a closed dialog never re-renders on registry changes.
const ShortcutSections = () => {
   const { list, getVersion, subscribe } = useShortcutRegistry();
   useSyncExternalStore(subscribe, getVersion, getVersion);
   const sections = groupShortcuts([
      ...list(),
      ...UNBOUND.map((hint) => ({ ...hint, handler: () => {} })),
   ]);

   return sections.map((section) => (
      <div key={section.group}>
         <SectionLabel as="h3" className="mb-2">
            {section.group}
         </SectionLabel>
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
   ));
};

const HelpDialog = () => {
   const { helpOpen, setHelpOpen } = useShortcutsContext();

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
               <ShortcutSections />
            </DialogBody>
         </DialogContent>
      </Dialog>
   );
};

export default HelpDialog;
