import {
   useGridContext,
   useGridPaginationContext,
} from "@/components/DataGrid/context";
import { useShortcut } from "@/lib/shortcuts";
import usePreferencesStore from "@/lib/stores/preferences-store";
import {
   folderAccessAt,
   rowBlockReason,
   writeBlockReason,
} from "@/lib/utils/folder-access";
import { folderHref, segmentsFromKey } from "@/lib/utils/s3/paths";
import { MAX_LIST_BLOCK_SIZE, observedETagSchema } from "@s3-viewer/types";
import { COMPACT } from "@/components/compact-button";
import { Toolbar } from "@/components/Layout/page";
import RefreshButton from "@/components/refresh-button";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { toast } from "@s3-viewer/ui/components/toast";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ArrowDownAZ,
   ArrowRightLeft,
   ChevronDown,
   Ellipsis,
   FileArchive,
   FileClock,
   FolderInput,
   FolderPlus,
   Info,
   Replace,
   Trash2,
} from "lucide-react";
import { useRouter } from "next/router";
import { useBucketContext } from "./Context";
import PrefixSearch from "@/components/Buckets/Grid/prefix-search";
import UploadMenu from "@/components/Buckets/Upload/upload-menu";
import { useUploader } from "@/components/Buckets/Upload/provider";
import useObjectCommands from "./useObjectCommands";

const SORT_LABEL = { first: "Folders first", mixed: "By name" } as const;
type SortOrder = keyof typeof SORT_LABEL;

const FOLDERS_FIRST_HINT =
   '"Folders first" only groups folders within each page of 1,000 objects, so past the first page some folders can still show up below files. Turn it off to sort strictly by name.';

const {
   button: COMPACT_BUTTON,
   label: COMPACT_LABEL,
   chevron: COMPACT_CHEVRON,
} = COMPACT.xl;

const SortMenu = () => {
   const foldersFirst = usePreferencesStore((state) => state.foldersFirst);
   const setFoldersFirst = usePreferencesStore(
      (state) => state.setFoldersFirst
   );
   const { rowCount } = useGridPaginationContext();
   const value: SortOrder = foldersFirst ? "first" : "mixed";
   const spansMultipleBlocks = foldersFirst && rowCount > MAX_LIST_BLOCK_SIZE;
   return (
      <DropdownMenu>
         <SimpleTooltip label="Sort order">
            <DropdownMenuTrigger asChild>
               <Button
                  variant="outline"
                  className={cn(
                     COMPACT_BUTTON,
                     "@xl:min-w-36 @xl:justify-between"
                  )}
               >
                  <ArrowDownAZ aria-hidden="true" />
                  <span className={COMPACT_LABEL}>{SORT_LABEL[value]}</span>
                  <ChevronDown className={COMPACT_CHEVRON} aria-hidden="true" />
               </Button>
            </DropdownMenuTrigger>
         </SimpleTooltip>
         <DropdownMenuContent
            align="end"
            className={spansMultipleBlocks ? "w-64" : "w-40"}
         >
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
            {spansMultipleBlocks && (
               <>
                  <DropdownMenuSeparator />
                  <p className="flex gap-2 px-2 py-1.5 text-xs leading-relaxed text-viewertext">
                     <Info
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                     />
                     {FOLDERS_FIRST_HINT}
                  </p>
               </>
            )}
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

const ObjectsToolbar = () => {
   const router = useRouter();
   const {
      serverId,
      bucketName,
      prefix,
      reach,
      refresh,
      isLoading,
      isRefreshing,
   } = useBucketContext();
   const { selectedIds, selectedObjects, clearSelection } = useGridContext();
   const commands = useObjectCommands();
   const { canUpload, blockedReason, notice } = useUploader();
   const folderBlocked = writeBlockReason(reach, prefix);
   const uploadsListable = folderAccessAt(reach, prefix) !== "dotted";
   const count = selectedIds.length;
   const refuseBlockedSelection = () => {
      for (const key of selectedIds) {
         const blocked = rowBlockReason(reach, key);
         if (blocked) {
            toast.error(blocked);
            return true;
         }
      }
      return false;
   };
   const withSelection = (
      run: (
         objects: { key: string; expectedETag: string; size: number | null }[]
      ) => void
   ) => {
      const objects = [];
      if (refuseBlockedSelection()) return;
      for (const key of selectedIds) {
         const snapshot = selectedObjects.get(key);
         const reviewed = observedETagSchema.safeParse(snapshot?.eTag);
         if (!snapshot || !reviewed.success) {
            toast.error(
               "Refresh and select the objects again before changing them."
            );
            return;
         }
         objects.push({
            key: snapshot.key,
            expectedETag: reviewed.data,
            size: snapshot.size,
         });
      }
      run(objects);
   };
   const removeSelection = () =>
      withSelection((objects) => commands.remove(objects, clearSelection));
   const moveSelection = () =>
      withSelection((objects) =>
         commands.moveMany({ objects, prefix }, clearSelection)
      );
   const transferSelection = () =>
      withSelection((objects) =>
         commands.transfer({ objects, prefix }, clearSelection)
      );
   const bulkRenameSelection = () =>
      withSelection((objects) =>
         commands.bulkRename({ objects }, clearSelection)
      );
   const canMove = commands.can.rename;
   const canBulkRename = commands.can.rename && commands.can.upload;
   const canDownload = commands.can.download;
   const hasSelectionActions = canMove || canBulkRename || canDownload;
   const showMoreMenu = hasSelectionActions || commands.can.delete;
   const goToFolder = (folderKey: string) =>
      void router.push(
         folderHref(serverId, bucketName, segmentsFromKey(folderKey))
      );

   useShortcut({
      keys: "r",
      label: "Refresh objects",
      group: "Objects",
      handler: refresh,
   });

   useShortcut({
      keys: "backspace",
      aliases: ["delete"],
      label: "Delete selected objects",
      group: "Objects",
      when: () => !isLoading && commands.can.delete && count > 0,
      handler: removeSelection,
   });

   const deleteLabel =
      count > 0 ? `Delete ${count} selected` : "Delete selection";

   const selectionCount = count > 0 && (
      <span className="ml-auto tabular-nums text-viewerlighttext">{count}</span>
   );

   return (
      <Toolbar>
         <PrefixSearch className="w-full min-w-0" />
         <div
            className="@container -mx-1 flex h-11 min-w-0 items-center gap-2 overflow-x-auto px-1 pointer-coarse:gap-1 [&>*]:shrink-0"
            aria-busy={isLoading || commands.isResolving || undefined}
         >
            <SortMenu />
            <RefreshButton
               spinning={isRefreshing}
               shortcut="r"
               onClick={refresh}
            />
            {commands.isResolving ? (
               // shaped like an editor's controls, the most common set; @xl widths are the labelled New folder and Upload buttons
               <>
                  <Skeleton className="h-9 w-9 rounded-lg pointer-coarse:h-11 pointer-coarse:@max-xl:w-11 @xl:w-[131px]" />
                  <Skeleton className="h-9 w-9 rounded-lg pointer-coarse:h-11 pointer-coarse:@max-xl:w-11 @xl:w-[130px]" />
                  <Skeleton className="size-9 rounded-lg pointer-coarse:size-11" />
                  <Skeleton className="size-9 rounded-lg pointer-coarse:size-11" />
               </>
            ) : (
               <>
                  {commands.can.upload && (
                     <SimpleTooltip label={folderBlocked ?? "New folder"}>
                        <Button
                           variant="outline"
                           className={COMPACT_BUTTON}
                           disabled={isLoading || folderBlocked !== null}
                           onClick={() =>
                              commands.createFolder(prefix, goToFolder)
                           }
                        >
                           <FolderPlus aria-hidden="true" />
                           <span className={COMPACT_LABEL}>New folder</span>
                        </Button>
                     </SimpleTooltip>
                  )}
                  {(canUpload || blockedReason) && (
                     <UploadMenu
                        className={COMPACT_BUTTON}
                        labelClassName={COMPACT_LABEL}
                        chevronClassName={COMPACT_CHEVRON}
                        disabled={isLoading || !canUpload}
                        blockedReason={blockedReason}
                     />
                  )}
                  {commands.can.delete && (
                     <SimpleTooltip label={deleteLabel} shortcut="backspace">
                        <Button
                           variant="destructive"
                           size="icon"
                           aria-label={deleteLabel}
                           disabled={isLoading || count === 0}
                           onClick={removeSelection}
                        >
                           <Trash2 aria-hidden="true" />
                        </Button>
                     </SimpleTooltip>
                  )}
                  {showMoreMenu && (
                     <DropdownMenu modal={false}>
                        <SimpleTooltip label="More bucket actions">
                           <DropdownMenuTrigger asChild>
                              <Button
                                 variant="outline"
                                 size="icon"
                                 aria-label="More bucket actions"
                              >
                                 <Ellipsis aria-hidden="true" />
                              </Button>
                           </DropdownMenuTrigger>
                        </SimpleTooltip>
                        <DropdownMenuContent align="end" className="w-52">
                           {hasSelectionActions && (
                              <DropdownMenuLabel>
                                 {count > 0
                                    ? `${count} selected`
                                    : "Select rows to use"}
                              </DropdownMenuLabel>
                           )}
                           {canMove && (
                              <DropdownMenuItem
                                 disabled={isLoading || count === 0}
                                 onSelect={moveSelection}
                              >
                                 <FolderInput aria-hidden="true" />
                                 Move
                                 {selectionCount}
                              </DropdownMenuItem>
                           )}
                           {canBulkRename && (
                              <DropdownMenuItem
                                 disabled={isLoading || count === 0}
                                 onSelect={bulkRenameSelection}
                              >
                                 <Replace aria-hidden="true" />
                                 Bulk rename
                                 {selectionCount}
                              </DropdownMenuItem>
                           )}
                           {canDownload && (
                              <DropdownMenuItem
                                 disabled={
                                    isLoading ||
                                    count === 0 ||
                                    commands.isPreparingZip
                                 }
                                 onSelect={() => {
                                    if (!refuseBlockedSelection())
                                       commands.downloadZip([...selectedIds]);
                                 }}
                              >
                                 <FileArchive aria-hidden="true" />
                                 Download zip
                                 {selectionCount}
                              </DropdownMenuItem>
                           )}
                           {canDownload && (
                              <DropdownMenuItem
                                 disabled={isLoading || count === 0}
                                 onSelect={transferSelection}
                              >
                                 <ArrowRightLeft aria-hidden="true" />
                                 Copy to bucket
                                 {selectionCount}
                              </DropdownMenuItem>
                           )}
                           {hasSelectionActions && commands.can.delete && (
                              <DropdownMenuSeparator />
                           )}
                           {commands.can.delete && (
                              <DropdownMenuItem
                                 disabled={!uploadsListable}
                                 onSelect={() =>
                                    commands.incompleteUploads(prefix)
                                 }
                              >
                                 <FileClock aria-hidden="true" />
                                 Incomplete uploads
                              </DropdownMenuItem>
                           )}
                        </DropdownMenuContent>
                     </DropdownMenu>
                  )}
                  {notice && (
                     <SimpleTooltip
                        label={
                           <span className="max-w-56 leading-relaxed">
                              {notice}
                           </span>
                        }
                     >
                        <Button
                           variant="ghost"
                           size="icon"
                           aria-label="About this server's storage"
                        >
                           <Info aria-hidden="true" />
                        </Button>
                     </SimpleTooltip>
                  )}
               </>
            )}
         </div>
      </Toolbar>
   );
};

export default ObjectsToolbar;
