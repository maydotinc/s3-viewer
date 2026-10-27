import * as React from "react";
import type { GridApi, GridReadyEvent, IDatasource } from "ag-grid-community";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { one } from "@/lib/test/elements";

const h = vi.hoisted(() => ({ ready: vi.fn() }));
vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: (initial: unknown) => [initial, vi.fn()],
   useMemo: (factory: () => unknown) => factory(),
   useRef: (value: unknown) => ({ current: value }),
   useCallback: (callback: unknown) => callback,
   useEffect: vi.fn(),
}));
vi.mock("ag-grid-react", () => ({ AgGridReact: "ag-grid" }));
vi.mock("./context", () => ({
   useGridPaginationContext: () => ({
      gridRef: { current: null },
      pageSize: 100,
      handlers: { onGridReady: h.ready },
   }),
}));
vi.mock("./overlays", () => ({ LoadingOverlay: "loading" }));
vi.mock("./skeleton", () => ({
   FittedGridSkeleton: "grid-skeleton",
   SKELETON_ROWS: 10,
}));
import Grid from "./grid";

const gridApi = () => ({
   isDestroyed: vi.fn(() => false),
   setGridOption: vi.fn(),
});

beforeEach(() => {
   vi.clearAllMocks();
});

describe("grid datasource ownership", () => {
   it("creates a separate datasource for every live grid instance", () => {
      const factory = vi.fn(
         (_api: GridApi): IDatasource => ({
            getRows: vi.fn(),
            destroy: vi.fn(),
         })
      );
      const tree = Grid({
         rowModel: "infinite",
         createDatasource: factory,
         cacheBlockSize: 1000,
         columnDefs: [],
         getRowId: () => "row",
         noRowsOverlayComponent: () => null,
      });
      const ready = one(tree, (node) => node.type === "ag-grid", "grid").props
         .onGridReady as (event: GridReadyEvent) => void;
      const first = gridApi();
      ready({ api: first } as unknown as GridReadyEvent);
      const firstSource = factory.mock.results[0]!.value;
      firstSource.destroy();
      first.isDestroyed.mockReturnValue(true);
      const second = gridApi();
      ready({ api: second } as unknown as GridReadyEvent);
      const secondSource = factory.mock.results[1]!.value;

      expect(secondSource).not.toBe(firstSource);
      expect(first.setGridOption).toHaveBeenCalledWith(
         "datasource",
         firstSource
      );
      expect(second.setGridOption).toHaveBeenCalledWith(
         "datasource",
         secondSource
      );
      expect(factory.mock.calls.map(([api]) => api)).toEqual([first, second]);
      expect(h.ready).toHaveBeenCalledTimes(2);

      ready({ api: first } as unknown as GridReadyEvent);
      expect(factory).toHaveBeenCalledTimes(2);
      expect(h.ready).toHaveBeenCalledTimes(2);
   });

   it("preserves client-side grid readiness without a datasource", () => {
      const tree = Grid({
         rowModel: "clientSide",
         rowData: [],
         columnDefs: [],
         getRowId: () => "row",
         noRowsOverlayComponent: () => null,
      });
      const ready = one(tree, (node) => node.type === "ag-grid", "grid").props
         .onGridReady as (event: GridReadyEvent) => void;
      const api = gridApi();
      ready({ api } as unknown as GridReadyEvent);
      expect(api.setGridOption).not.toHaveBeenCalled();
      expect(h.ready).toHaveBeenCalledOnce();
   });
});
