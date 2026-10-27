import type { ColDef } from "ag-grid-community";
import { describe, expect, it } from "vitest";
import { objectColumns } from "@/components/Buckets/Grid/columns";
import { hiddenColumnIds, withHiddenColumns } from "./fit-columns";

const columns: ColDef[] = [
   { colId: "select", width: 40 },
   { colId: "name", flex: 1, minWidth: 160 },
   { colId: "size", width: 120, context: { dropOrder: 2 } },
   { colId: "modified", width: 200, context: { dropOrder: 1 } },
   { colId: "actions", width: 64 },
];

describe("fitting grid columns to the grid width", () => {
   it("keeps every column when the minimum widths fit", () => {
      expect(hiddenColumnIds(columns, 600)).toEqual([]);
   });

   it("drops columns in drop order until the rest fit", () => {
      expect(hiddenColumnIds(columns, 599)).toEqual(["modified"]);
      expect(hiddenColumnIds(columns, 399)).toEqual(["modified", "size"]);
   });

   it("never hides a column without a drop order", () => {
      expect(hiddenColumnIds(columns, 10)).toEqual(["modified", "size"]);
   });

   it("sets an explicit hide value so a column dropped earlier comes back", () => {
      const narrow = withHiddenColumns(columns, ["modified"]);
      expect(narrow.map((column) => column.hide)).toEqual([
         undefined,
         undefined,
         false,
         true,
         undefined,
      ]);
      expect(narrow[0]).toBe(columns[0]);
      expect(
         withHiddenColumns(columns, []).find(
            (column) => column.colId === "modified"
         )?.hide
      ).toBe(false);
   });

   it("fits the object browser's name, selection and actions on a 320px phone", () => {
      const phoneGrid = 320 - 2 * 16 - 2;
      expect(hiddenColumnIds(objectColumns, phoneGrid)).toEqual([
         "modified",
         "size",
      ]);
      expect(hiddenColumnIds(objectColumns, 1024)).toEqual([]);
   });
});
