import type { SecondaryAction } from "@/components/Buckets/Grid/action-menu";
import type { ObjectCommands } from "@/components/Buckets/useObjectCommands";
import type { ObjectPermissions } from "@/lib/hooks/usePermission";
import { canPresignObjectKey } from "@s3-viewer/shared";
import {
   ArrowRightLeft,
   CopyPlus,
   Download,
   FileArchive,
   FilePen,
   FolderInput,
   Link2,
   Replace,
   SlidersHorizontal,
   Trash2,
   type LucideIcon,
} from "lucide-react";

type ActionDefinition = {
   label: string;
   icon: LucideIcon;
   destructive?: boolean;
   allowed: (can: ObjectPermissions) => boolean;
};

// every surface takes its wording, icon and permission from here so menus can't drift apart
const OBJECT_ACTIONS = {
   download: {
      label: "Download",
      icon: Download,
      allowed: (can) => can.download,
   },
   zip: {
      label: "Download as zip",
      icon: FileArchive,
      allowed: (can) => can.download,
   },
   copyLink: {
      label: "Copy link",
      icon: Link2,
      allowed: (can) => can.download,
   },
   settings: {
      label: "Edit settings",
      icon: SlidersHorizontal,
      allowed: (can) => can.upload,
   },
   rename: { label: "Rename", icon: FilePen, allowed: (can) => can.rename },
   renameFolder: {
      label: "Rename folder",
      icon: FolderInput,
      allowed: (can) => can.rename,
   },
   move: { label: "Move", icon: FolderInput, allowed: (can) => can.rename },
   bulkRename: {
      label: "Bulk rename…",
      icon: Replace,
      allowed: (can) => can.rename && can.upload,
   },
   copy: { label: "Copy to…", icon: CopyPlus, allowed: (can) => can.upload },
   transfer: {
      label: "Copy to another bucket…",
      icon: ArrowRightLeft,
      allowed: (can) => can.download,
   },
   delete: {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      allowed: (can) => can.delete,
   },
   deleteFolder: {
      label: "Delete folder",
      icon: Trash2,
      destructive: true,
      allowed: (can) => can.delete,
   },
} satisfies Record<string, ActionDefinition>;

type ObjectActionId = keyof typeof OBJECT_ACTIONS;

type ObjectAction = SecondaryAction & { id: ObjectActionId };

type ReviewedObject = {
   key: string;
   expectedETag: string;
   size: number | null;
};

type ActionTarget =
   | {
        kind: "object";
        key: string;
        eTag: string | null;
        // a listing row knows its size and folder, which copying to another bucket needs
        listing?: { size: number | null; prefix: string };
        onRenamed?: (newObjectKey: string) => void;
        onCopied?: (newObjectKey: string) => void;
        onDeleted?: () => void;
     }
   | {
        kind: "folder";
        key: string;
        renameBlocked: string | null;
        onRenamed?: (destination: string) => void;
     }
   | {
        kind: "selection";
        prefix: string;
        keys: readonly string[];
        // both toast when the selection can't be sent: blocked() returns true, reviewed() null
        blocked: () => boolean;
        reviewed: () => ReviewedObject[] | null;
        onSettled: () => void;
     };

type Draft = Partial<SecondaryAction> & {
   id: ObjectActionId;
   onSelect: () => void;
};

const objectDrafts = (
   commands: ObjectCommands,
   target: ActionTarget
): Draft[] => {
   if (target.kind === "folder") {
      const source = { folderKey: target.key };
      return [
         {
            id: "renameFolder",
            disabled: Boolean(target.renameBlocked),
            description: target.renameBlocked,
            onSelect: () => commands.moveMany(source, target.onRenamed),
         },
         { id: "bulkRename", onSelect: () => commands.bulkRename(source) },
         { id: "transfer", onSelect: () => commands.transfer(source) },
         {
            id: "zip",
            disabled: commands.isPreparingZip,
            onSelect: () => commands.downloadZip([target.key]),
         },
         {
            id: "deleteFolder",
            onSelect: () =>
               commands.remove([{ key: target.key, expectedETag: null }]),
         },
      ];
   }
   if (target.kind === "selection") {
      const { prefix, onSettled } = target;
      const withObjects = (run: (objects: ReviewedObject[]) => void) => () => {
         const objects = target.reviewed();
         if (objects) run(objects);
      };
      return [
         {
            id: "move",
            onSelect: withObjects((objects) =>
               commands.moveMany({ objects, prefix }, onSettled)
            ),
         },
         {
            id: "bulkRename",
            onSelect: withObjects((objects) =>
               commands.bulkRename({ objects }, onSettled)
            ),
         },
         {
            id: "zip",
            disabled: commands.isPreparingZip,
            onSelect: () => {
               if (!target.blocked()) commands.downloadZip([...target.keys]);
            },
         },
         {
            id: "transfer",
            onSelect: withObjects((objects) =>
               commands.transfer({ objects, prefix }, onSettled)
            ),
         },
         {
            id: "delete",
            onSelect: withObjects((objects) =>
               commands.remove(objects, onSettled)
            ),
         },
      ];
   }
   const { key, eTag, listing } = target;
   const presignable = canPresignObjectKey(key);
   const drafts: Draft[] = [
      {
         id: "download",
         label: presignable
            ? OBJECT_ACTIONS.download.label
            : OBJECT_ACTIONS.zip.label,
         onSelect: () => void commands.download(key),
      },
      { id: "copyLink", onSelect: () => void commands.copyLink(key) },
      { id: "settings", onSelect: () => commands.editSettings(key, eTag) },
      {
         id: "rename",
         onSelect: () => commands.rename(key, eTag, target.onRenamed),
      },
      { id: "copy", onSelect: () => commands.copy(key, eTag, target.onCopied) },
      ...(listing
         ? [
              {
                 id: "transfer" as const,
                 onSelect: () =>
                    commands.transfer({
                       objects: [
                          { key, expectedETag: eTag, size: listing.size },
                       ],
                       prefix: listing.prefix,
                    }),
              },
           ]
         : []),
      {
         id: "delete",
         onSelect: () =>
            commands.remove([{ key, expectedETag: eTag }], target.onDeleted),
      },
   ];
   return presignable
      ? drafts
      : drafts.filter((draft) => draft.id !== "copyLink");
};

// the actions the caller may take on a target, in menu order; a cramped surface can shorten labels
const objectActions = (
   commands: ObjectCommands,
   target: ActionTarget,
   labels: Partial<Record<ObjectActionId, string>> = {}
): ObjectAction[] =>
   objectDrafts(commands, target).flatMap((draft) => {
      const { label, icon, destructive, allowed }: ActionDefinition =
         OBJECT_ACTIONS[draft.id];
      return allowed(commands.can)
         ? [
              {
                 icon,
                 destructive,
                 ...draft,
                 label: labels[draft.id] ?? draft.label ?? label,
              },
           ]
         : [];
   });

export { OBJECT_ACTIONS, objectActions };
export type { ReviewedObject };
