import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { ICellRendererParams, IHeaderParams } from "ag-grid-community";
import { useCallback, useEffect, useState } from "react";

const SelectionCellRenderer = (params: ICellRendererParams) => {
   const [isSelected, setIsSelected] = useState<boolean>(
      params.node.isSelected() ?? false
   );

   useEffect(() => {
      const updateSelection = () => {
         setIsSelected(params.node.isSelected() ?? false);
      };

      params.api.addEventListener("selectionChanged", updateSelection);

      return () => {
         params.api.removeEventListener("selectionChanged", updateSelection);
      };
   }, [params.node]);

   const handleToggle = useCallback(() => {
      params.node.setSelected(!params.node.isSelected());
   }, [params.node]);

   if (params.data === undefined) {
      return <></>;
   }

   return (
      <div className="flex items-center justify-center h-full">
         {params.data?.Key?.endsWith("/") ? (
            <></>
         ) : (
            <Checkbox checked={isSelected} onCheckedChange={handleToggle} />
         )}
      </div>
   );
};

const SelectionHeader = (params: IHeaderParams) => {
   const [allSelected, setAllSelected] = useState(false);
   const [indeterminate, setIndeterminate] = useState(false);

   const updateHeaderState = useCallback(() => {
      const pageSize = params.api.paginationGetPageSize();
      const currentPage = params.api.paginationGetCurrentPage();
      const startIndex = currentPage * pageSize;

      const pageNodes: any[] = [];
      for (let i = 0; i < pageSize; i++) {
         const node = params.api.getDisplayedRowAtIndex(startIndex + i);
         if (node) {
            pageNodes.push(node);
         }
      }

      const selectableNodes = pageNodes.filter(
         (node) => !node.data?.Key?.endsWith("/")
      );

      const totalCount = selectableNodes.length;
      const selectedCountOnPage = selectableNodes.filter((node) =>
         node.isSelected()
      ).length;

      setAllSelected(selectedCountOnPage === totalCount && totalCount > 0);
      setIndeterminate(
         selectedCountOnPage > 0 && selectedCountOnPage < totalCount
      );
   }, [params.api]);

   useEffect(() => {
      const onSelectionChanged = () => {
         updateHeaderState();
      };
      params.api.addEventListener("selectionChanged", onSelectionChanged);
      updateHeaderState();
      return () => {
         params.api.removeEventListener("selectionChanged", onSelectionChanged);
      };
   }, [params.api, updateHeaderState]);

   const handleSelectAll = useCallback(() => {
      const pageSize = params.api.paginationGetPageSize();
      const currentPage = params.api.paginationGetCurrentPage();
      const startIndex = currentPage * pageSize;

      const pageNodes: any[] = [];
      for (let i = 0; i < pageSize; i++) {
         const node = params.api.getDisplayedRowAtIndex(startIndex + i);
         if (node) {
            pageNodes.push(node);
         }
      }

      const selectableNodes = pageNodes.filter(
         (node) => !node.data?.Key?.endsWith("/")
      );

      if (allSelected || indeterminate) {
         params.api.deselectAll();
      } else {
         params.api.setNodesSelected({
            nodes: selectableNodes,
            newValue: true,
         });
      }
   }, [params.api, allSelected, indeterminate]);

   return (
      <div className="flex items-center justify-center size-full">
         <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            data-indeterminate={indeterminate ? "true" : "false"}
         />
      </div>
   );
};

const selectorColumn = {
   headerName: "",
   colId: "selector",
   width: 30,
   sortable: false,
   resizable: false,
   suppressHeaderMenuButton: true,
   suppressColumnsToolPanel: true,
   cellRenderer: SelectionCellRenderer,
   headerComponent: SelectionHeader,
   cellStyle: {
      paddingRight: "0px",
      paddingLeft: "0px",
   },
   headerStyle: {
      paddingRight: "0px",
      paddingLeft: "0px",
   },
};

const rowSelection = {
   mode: "multiRow" as const,
   checkboxes: false,
   headerCheckbox: false,
};

export { rowSelection, selectorColumn };
