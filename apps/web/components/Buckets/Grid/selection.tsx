import { useSelectionContext } from "@/components/DataGrid/context";
import { rowBlockReason, type KnownReach } from "@/lib/utils/folder-access";
import { visibleText } from "@/lib/utils/format";
import type { S3Object } from "@s3-viewer/shared";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import type {
   ColDef,
   ICellRendererParams,
   IHeaderParams,
   IRowNode,
   RowSelectionOptions,
} from "ag-grid-community";
import { useCallback, useEffect, useState } from "react";
import { useObjectGridState } from "./grid-state";

const HIT_AREA =
   "flex size-full cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed";

const pageFileNodes = (
   api: IHeaderParams["api"],
   reach: KnownReach
): IRowNode<S3Object>[] => {
   const pageSize = api.paginationGetPageSize();
   const start = api.paginationGetCurrentPage() * pageSize;
   const nodes: IRowNode<S3Object>[] = [];
   for (let i = start; i < start + pageSize; i++) {
      const node = api.getDisplayedRowAtIndex(i) as
         | IRowNode<S3Object>
         | undefined;
      if (
         node?.data &&
         !node.data.isFolder &&
         !rowBlockReason(reach, node.data.key)
      )
         nodes.push(node);
   }
   return nodes;
};

const SelectionCell = (params: ICellRendererParams<S3Object>) => {
   const { selectedIdSet } = useSelectionContext();
   const { reach } = useObjectGridState();
   const data = params.data;
   if (!data || data.isFolder) return null;
   const checked = selectedIdSet.has(data.key);
   const blocked = rowBlockReason(reach, data.key) !== null;
   return (
      <label className={HIT_AREA}>
         <Checkbox
            aria-label={`Select ${visibleText(data.key)}`}
            checked={checked}
            disabled={blocked && !checked}
            onCheckedChange={(next) => params.node.setSelected(next === true)}
         />
      </label>
   );
};

const SelectionHeader = (params: IHeaderParams<S3Object>) => {
   const { selectedIdSet } = useSelectionContext();
   const { reach } = useObjectGridState();
   const [, setRevision] = useState(0);
   const api = params.api;

   useEffect(() => {
      const bump = () => setRevision((value) => value + 1);
      api.addEventListener("modelUpdated", bump);
      api.addEventListener("paginationChanged", bump);
      return () => {
         if (api.isDestroyed()) return;
         api.removeEventListener("modelUpdated", bump);
         api.removeEventListener("paginationChanged", bump);
      };
   }, [api]);

   const nodes = pageFileNodes(api, reach);
   const selectedOnPage = nodes.filter((node) =>
      selectedIdSet.has(node.data?.key ?? "")
   );
   const all = nodes.length > 0 && selectedOnPage.length === nodes.length;
   const some = selectedOnPage.length > 0 && !all;

   const toggle = useCallback(() => {
      const target = pageFileNodes(params.api, reach);
      const selectAll = !target.every((node) => node.isSelected());
      params.api.setNodesSelected({ nodes: target, newValue: selectAll });
   }, [params.api, reach]);

   return (
      <label className={HIT_AREA}>
         <Checkbox
            aria-label="Select all objects on this page"
            checked={all ? true : some ? "indeterminate" : false}
            disabled={nodes.length === 0}
            onCheckedChange={toggle}
         />
      </label>
   );
};

const selectionColumn: ColDef<S3Object> = {
   colId: "select",
   headerName: "Select",
   width: 40,
   minWidth: 40,
   maxWidth: 40,
   cellRenderer: SelectionCell,
   headerComponent: SelectionHeader,
   cellStyle: { padding: 0 },
   headerStyle: { padding: 0 },
};

const objectRowSelection: RowSelectionOptions<S3Object> = {
   mode: "multiRow",
   checkboxes: false,
   headerCheckbox: false,
   enableClickSelection: false,
   isRowSelectable: (node) => Boolean(node.data) && !node.data?.isFolder,
};

export { objectRowSelection, selectionColumn };
