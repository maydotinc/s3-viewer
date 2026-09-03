import { useGridContext } from "@/components/DataGrid/context";
import type { S3Object } from "@s3-viewer/types";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import type {
   ColDef,
   ICellRendererParams,
   IHeaderParams,
   IRowNode,
   RowSelectionOptions,
} from "ag-grid-community";
import { useCallback } from "react";

const pageFileNodes = (api: IHeaderParams["api"]): IRowNode<S3Object>[] => {
   const pageSize = api.paginationGetPageSize();
   const start = api.paginationGetCurrentPage() * pageSize;
   const nodes: IRowNode<S3Object>[] = [];
   for (let i = start; i < start + pageSize; i++) {
      const node = api.getDisplayedRowAtIndex(i) as
         | IRowNode<S3Object>
         | undefined;
      if (node?.data && !node.data.isFolder) nodes.push(node);
   }
   return nodes;
};

const SelectionCell = (params: ICellRendererParams<S3Object>) => {
   const { selectedIds } = useGridContext();
   const data = params.data;
   if (!data || data.isFolder) return null;
   const checked = selectedIds.includes(data.key);
   return (
      <div className="flex h-full items-center justify-center">
         <Checkbox
            aria-label={`Select ${data.key}`}
            checked={checked}
            onCheckedChange={(next) => params.node.setSelected(next === true)}
         />
      </div>
   );
};

const SelectionHeader = (params: IHeaderParams<S3Object>) => {
   const { selectedIds } = useGridContext();
   const nodes = pageFileNodes(params.api);
   const selectedOnPage = nodes.filter((node) =>
      selectedIds.includes(node.data?.key ?? "")
   );
   const all = nodes.length > 0 && selectedOnPage.length === nodes.length;
   const some = selectedOnPage.length > 0 && !all;

   const toggle = useCallback(() => {
      const target = pageFileNodes(params.api);
      const selectAll = !target.every((node) => node.isSelected());
      params.api.setNodesSelected({ nodes: target, newValue: selectAll });
   }, [params.api]);

   return (
      <div className="flex size-full items-center justify-center">
         <Checkbox
            aria-label="Select all files on this page"
            checked={all ? true : some ? "indeterminate" : false}
            disabled={nodes.length === 0}
            onCheckedChange={toggle}
         />
      </div>
   );
};

const selectionColumn: ColDef<S3Object> = {
   colId: "select",
   headerName: "Select",
   width: 44,
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
