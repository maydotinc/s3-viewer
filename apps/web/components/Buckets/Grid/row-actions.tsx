import type { ObjectCommands } from "@/components/Buckets/useObjectCommands";
import OverflowMenu from "@/components/overflow-menu";
import {
   renameBlockReason,
   rowBlockReason,
   type KnownReach,
} from "@/lib/utils/folder-access";
import { visibleText } from "@/lib/utils/format";
import { folderHref, segmentsFromKey } from "@/lib/utils/s3/paths";
import { baseName, canPresignObjectKey, type S3Object } from "@s3-viewer/types";
import type { ICellRendererParams } from "ag-grid-community";
import {
   ArrowRightLeft,
   CopyPlus,
   Download,
   FileArchive,
   FilePen,
   FolderInput,
   Link2,
   Replace,
   Trash2,
} from "lucide-react";
import { useRouter } from "next/router";
import { memo } from "react";
import { ActionMenuItems, type SecondaryAction } from "./action-menu";
import { useObjectGridState } from "./grid-state";

const RowActionsMenu = ({
   serverId,
   bucketName,
   prefix,
   reach,
   data,
   commands,
}: {
   serverId: string;
   bucketName: string;
   prefix: string;
   reach: KnownReach;
   data: S3Object;
   commands: ObjectCommands;
}) => {
   const router = useRouter();
   const name = visibleText(baseName(data.key));
   const { can } = commands;
   const removeRow = () =>
      commands.remove([{ key: data.key, expectedETag: data.eTag }]);
   const transferRow = () =>
      commands.transfer(
         data.isFolder
            ? { folderKey: data.key }
            : {
                 objects: [
                    {
                       key: data.key,
                       expectedETag: data.eTag,
                       size: data.size,
                    },
                 ],
                 prefix,
              }
      );
   const renameBlocked = renameBlockReason(reach, data.key);
   const presignable = canPresignObjectKey(data.key);
   const listed: (SecondaryAction | false)[] = data.isFolder
      ? [
           can.rename && {
              label: "Rename folder",
              icon: FolderInput,
              disabled: Boolean(renameBlocked),
              description: renameBlocked,
              onSelect: () =>
                 commands.moveMany(
                    { folderKey: data.key },
                    (destination) =>
                       void router.push(
                          folderHref(
                             serverId,
                             bucketName,
                             segmentsFromKey(destination)
                          )
                       )
                 ),
           },
           can.rename &&
              can.upload && {
                 label: "Bulk rename…",
                 icon: Replace,
                 onSelect: () => commands.bulkRename({ folderKey: data.key }),
              },
           can.download && {
              label: "Copy to another bucket…",
              icon: ArrowRightLeft,
              onSelect: transferRow,
           },
           can.download && {
              label: "Download as zip",
              icon: FileArchive,
              onSelect: () => commands.downloadZip([data.key]),
           },
           can.delete && {
              label: "Delete folder",
              icon: Trash2,
              destructive: true,
              onSelect: removeRow,
           },
        ]
      : [
           can.download && {
              label: presignable ? "Download" : "Download as zip",
              icon: Download,
              onSelect: () => void commands.download(data.key),
           },
           can.download &&
              presignable && {
                 label: "Copy link",
                 icon: Link2,
                 onSelect: () => void commands.copyLink(data.key),
              },
           can.rename && {
              label: "Rename",
              icon: FilePen,
              onSelect: () => commands.rename(data.key, data.eTag),
           },
           can.upload && {
              label: "Copy to…",
              icon: CopyPlus,
              onSelect: () => commands.copy(data.key, data.eTag),
           },
           can.download && {
              label: "Copy to another bucket…",
              icon: ArrowRightLeft,
              onSelect: transferRow,
           },
           can.delete && {
              label: "Delete",
              icon: Trash2,
              destructive: true,
              onSelect: removeRow,
           },
        ];
   const actions = listed.filter((action): action is SecondaryAction =>
      Boolean(action)
   );
   if (actions.length === 0) return null;

   return (
      <div className="flex h-full items-center justify-center">
         <OverflowMenu
            label={name}
            disabledReason={rowBlockReason(reach, data.key)}
         >
            <ActionMenuItems actions={actions} />
         </OverflowMenu>
      </div>
   );
};

// rows re-render on every pagination event; the menu only needs to when its own inputs change
const MemoRowActionsMenu = memo(RowActionsMenu);

const RowActions = (params: ICellRendererParams<S3Object>) => {
   const { serverId, bucketName, prefix, reach, commands } =
      useObjectGridState();
   const data = params.data;
   if (!data) return null;
   return (
      <MemoRowActionsMenu
         serverId={serverId}
         bucketName={bucketName}
         prefix={prefix}
         reach={reach}
         data={data}
         commands={commands}
      />
   );
};

export default RowActions;
export { RowActionsMenu };
