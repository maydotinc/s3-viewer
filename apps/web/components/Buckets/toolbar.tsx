import { useGridContext } from "@/components/DataGrid/context";
import { usePermission } from "@/lib/hooks/usePermission";
import { useShortcut } from "@/lib/shortcuts";
import { Permission } from "@s3-viewer/permissions";
import usePreferencesStore from "@/lib/stores/preferencesStore";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { ArrowDownAZ, ChevronDown, RefreshCw, Trash2 } from "lucide-react";
import { useBucketContext } from "./Context";
import PrefixSearch from "./Grid/prefix-search";
import UploadMenu from "./Upload/upload-menu";
import useObjectCommands from "./useObjectCommands";

const SORT_LABEL = { first: "Folders first", mixed: "By name" } as const;
type SortOrder = keyof typeof SORT_LABEL;

const SortMenu = () => {
   const foldersFirst = usePreferencesStore((state) => state.foldersFirst);
   const setFoldersFirst = usePreferencesStore(
      (state) => state.setFoldersFirst
   );
   const value: SortOrder = foldersFirst ? "first" : "mixed";
   return (
      <DropdownMenu>
         <SimpleTooltip label="Sort order">
            <DropdownMenuTrigger asChild>
               <Button variant="outline" className="min-w-36 justify-between">
                  <ArrowDownAZ aria-hidden="true" />
                  {SORT_LABEL[value]}
                  <ChevronDown aria-hidden="true" />
               </Button>
            </DropdownMenuTrigger>
         </SimpleTooltip>
         <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuRadioGroup
               value={value}
               onValueChange={(next) => setFoldersFirst(next === "first")}
            >
               {(Object.keys(SORT_LABEL) as SortOrder[]).map((order) => (
                  <DropdownMenuRadioItem key={order} value={order}>
                     {SORT_LABEL[order]}
                  </DropdownMenuRadioItem>
               ))}
            </DropdownMenuRadioGroup>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

const ObjectsToolbar = () => {
   const { bucketName, refresh, isLoading } = useBucketContext();
   const { selectedIds, clearSelection } = useGridContext();
   const commands = useObjectCommands(bucketName);
   const canUpload = usePermission(Permission.UPLOAD_OBJECT, bucketName);
   const count = selectedIds.length;

   useShortcut({
      keys: "r",
      label: "Refresh objects",
      group: "Objects",
      handler: refresh,
   });

   useShortcut({
      // ⌫ is the key people actually reach for; ⌦ does the same thing.
      keys: "backspace",
      aliases: ["delete"],
      label: "Delete selected objects",
      group: "Objects",
      when: () => !isLoading && commands.can.delete && count > 0,
      handler: () => commands.remove(selectedIds, clearSelection),
   });

   // While the bucket loads the real buttons render disabled rather than as
   // placeholders: a placeholder can only approximate a label's width, so the
   // row visibly settled by a few pixels when the buttons replaced it.
   return (
      <div className="flex min-h-9 flex-wrap items-center gap-2">
         <PrefixSearch className="w-72 shrink-0" />
         <div
            className="ml-auto flex flex-wrap items-center justify-end gap-2"
            aria-busy={isLoading || undefined}
         >
            <SortMenu />
            <SimpleTooltip label="Refresh" shortcut="r">
               <Button variant="outline" onClick={refresh}>
                  <RefreshCw aria-hidden="true" />
                  Refresh
               </Button>
            </SimpleTooltip>
            {canUpload && <UploadMenu disabled={isLoading} />}
            {commands.can.delete && (
               <SimpleTooltip label="Delete selection" shortcut="backspace">
                  <Button
                     variant="destructive"
                     disabled={isLoading || count === 0}
                     onClick={() =>
                        commands.remove(selectedIds, clearSelection)
                     }
                  >
                     <Trash2 aria-hidden="true" />
                     Delete
                     {count > 0 && (
                        <span className="tabular-nums">({count})</span>
                     )}
                  </Button>
               </SimpleTooltip>
            )}
         </div>
      </div>
   );
};

export default ObjectsToolbar;
