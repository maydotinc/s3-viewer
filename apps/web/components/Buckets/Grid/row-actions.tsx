import { objectActions } from "@/components/Buckets/object-actions";
import type { ObjectCommands } from "@/components/Buckets/useObjectCommands";
import OverflowMenu from "@/components/overflow-menu";
import {
   renameBlockReason,
   rowBlockReason,
   type KnownReach,
} from "@/lib/utils/folder-access";
import { visibleText } from "@/lib/utils/format";
import { folderHref, segmentsFromKey } from "@/lib/utils/s3/paths";
import { baseName, type S3Object } from "@s3-viewer/shared";
import type { ICellRendererParams } from "ag-grid-community";
import { useRouter } from "next/router";
import { memo } from "react";
import { ActionMenuItems } from "./action-menu";
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
   const actions = data.isFolder
      ? objectActions(commands, {
           kind: "folder",
           key: data.key,
           renameBlocked: renameBlockReason(reach, data.key),
           onRenamed: (destination) =>
              void router.push(
                 folderHref(serverId, bucketName, segmentsFromKey(destination))
              ),
        })
      : objectActions(commands, {
           kind: "object",
           key: data.key,
           eTag: data.eTag,
           listing: { size: data.size, prefix },
        }).filter(({ id }) => id !== "settings");
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
