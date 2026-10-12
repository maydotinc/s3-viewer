import type { ColDef } from "ag-grid-community";

type FitContext = { dropOrder?: number };

const SCROLLBAR_ALLOWANCE = 16;

const dropOrderOf = (column: ColDef): number | undefined =>
   (column.context as FitContext | undefined)?.dropOrder;

const columnId = (column: ColDef, index: number): string =>
   column.colId ?? column.field ?? String(index);

const hiddenColumnIds = (
   columns: readonly ColDef[],
   gridWidth: number
): string[] => {
   let required =
      SCROLLBAR_ALLOWANCE +
      columns.reduce(
         (sum, column) => sum + (column.width ?? column.minWidth ?? 0),
         0
      );
   const droppable = columns
      .map((column, index) => ({
         id: columnId(column, index),
         order: dropOrderOf(column),
         width: column.width ?? column.minWidth ?? 0,
      }))
      .filter(
         (entry): entry is typeof entry & { order: number } =>
            entry.order !== undefined
      )
      .sort((left, right) => left.order - right.order);
   const hidden: string[] = [];
   for (const entry of droppable) {
      if (required <= gridWidth) break;
      hidden.push(entry.id);
      required -= entry.width;
   }
   return hidden;
};

// AG Grid keeps a column's previous `hide` when it's undefined, so always set it.
const withHiddenColumns = <TData>(
   columns: ColDef<TData>[],
   hidden: readonly string[]
): ColDef<TData>[] =>
   columns.map((column, index) =>
      dropOrderOf(column) === undefined
         ? column
         : { ...column, hide: hidden.includes(columnId(column, index)) }
   );

export { hiddenColumnIds, withHiddenColumns };
export type { FitContext };
