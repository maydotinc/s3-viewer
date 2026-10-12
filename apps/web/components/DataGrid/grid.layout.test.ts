// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";

type GridEvents = {
   className: string;
   columnDefs: { colId: string; hide?: boolean }[];
   onGridSizeChanged: (event: {
      clientWidth: number;
      clientHeight: number;
   }) => void;
   onColumnResized: () => void;
};
const h = vi.hoisted(() => ({ props: null as GridEvents | null }));
vi.mock("ag-grid-react", () => ({
   AgGridReact: (props: GridEvents) => {
      h.props = props;
      return createElement("div", {
         "data-testid": "grid",
         className: props.className,
      });
   },
}));
vi.mock("./context", () => ({
   useGridPaginationContext: () => ({
      gridRef: { current: null },
      pageSize: 100,
      handlers: {},
   }),
}));
vi.mock("./overlays", () => ({ LoadingOverlay: () => null }));
import Grid from "./grid";

const view = mountedRuntime(() => vi.unstubAllGlobals());
let nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();
const tick = () => {
   const pending = [...frames.values()];
   frames.clear();
   for (const callback of pending) callback(0);
};
const mount = async (columnDefs: GridEvents["columnDefs"] = []) => {
   await view.mount(
      createElement(Grid, {
         rowModel: "clientSide",
         rowData: [],
         columnDefs,
         getRowId: () => "row",
         noRowsOverlayComponent: () => null,
      })
   );
};
const grid = () =>
   view.current.container.querySelector('[data-testid="grid"]')!.parentElement!;

beforeEach(() => {
   frames.clear();
   nextFrame = 0;
   vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
   });
   vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

describe("initial grid layout", () => {
   it("keeps initial columns hidden until a measurable grid has completed both layout frames", async () => {
      await mount();
      const themedGrid = view.current.container.querySelector(
         '[data-testid="grid"]'
      )!;
      themedGrid.classList.add("ag-theme-params-fixture");
      expect(grid().classList.contains("invisible")).toBe(true);
      h.props!.onColumnResized();
      h.props!.onGridSizeChanged({ clientWidth: 0, clientHeight: 0 });
      expect(frames.size).toBe(0);
      h.props!.onGridSizeChanged({ clientWidth: 900, clientHeight: 600 });
      await act(async () => tick());
      expect(grid().classList.contains("invisible")).toBe(true);
      h.props!.onColumnResized();
      await act(async () => tick());
      expect(grid().classList.contains("invisible")).toBe(true);
      await act(async () => tick());
      expect(grid().classList.contains("invisible")).toBe(false);
      expect(view.current.container.querySelector('[data-testid="grid"]')).toBe(
         themedGrid
      );
      expect(themedGrid.classList.contains("ag-theme-params-fixture")).toBe(
         true
      );
      expect(view.current.container.textContent).not.toContain("Loading table");
      h.props!.onColumnResized();
      expect(frames.size).toBe(0);
   });

   it("cancels the pending reveal when the grid is removed", async () => {
      await mount();
      h.props!.onGridSizeChanged({ clientWidth: 900, clientHeight: 600 });
      await act(async () => tick());
      expect(frames.size).toBe(1);
      await view.current.unmount();
      expect(frames.size).toBe(0);
   });
});

describe("placeholder while the grid is hidden", () => {
   const columns = [
      { colId: "name", flex: 1, minWidth: 160 },
      { colId: "modified", width: 200, context: { dropOrder: 1 } },
   ];
   const placeholder = () =>
      view.current.container.querySelector(".absolute.inset-0");
   const measureAs = (width: number) =>
      vi
         .spyOn(HTMLElement.prototype, "clientWidth", "get")
         .mockReturnValue(width);

   it("keeps skeleton rows on screen until the grid is revealed, with no spinner in between", async () => {
      await mount(columns);
      expect(placeholder()!.getAttribute("aria-busy")).toBe("true");
      expect(
         placeholder()!.querySelector('[aria-label="Loading rows"]')
      ).not.toBeNull();
      expect(
         view.current.container.querySelector('[role="status"]')
      ).toBeNull();
      h.props!.onGridSizeChanged({ clientWidth: 900, clientHeight: 600 });
      await act(async () => tick());
      expect(placeholder()).not.toBeNull();
      await act(async () => tick());
      expect(placeholder()).toBeNull();
   });

   it.each([
      { width: 300, shown: 1 },
      { width: 900, shown: 2 },
   ])(
      "draws $shown column(s) at $width px, the ones the grid itself will keep",
      async ({ width, shown }) => {
         const measured = measureAs(width);
         await mount(columns);
         expect(placeholder()!.firstElementChild!.children).toHaveLength(shown);
         measured.mockRestore();
      }
   );
});

describe("responsive columns", () => {
   const columns = [
      { colId: "name", flex: 1, minWidth: 160 },
      { colId: "modified", width: 200, context: { dropOrder: 1 } },
   ];
   const hidden = () =>
      h.props!.columnDefs.filter((column) => column.hide).map((c) => c.colId);

   it("hides droppable columns before the grid is revealed and restores them when it widens", async () => {
      await mount(columns);
      expect(hidden()).toEqual([]);
      await act(async () =>
         h.props!.onGridSizeChanged({ clientWidth: 300, clientHeight: 600 })
      );
      expect(hidden()).toEqual(["modified"]);
      expect(grid().classList.contains("invisible")).toBe(true);
      const narrowDefs = h.props!.columnDefs;
      await act(async () =>
         h.props!.onGridSizeChanged({ clientWidth: 320, clientHeight: 600 })
      );
      expect(h.props!.columnDefs).toBe(narrowDefs);
      await act(async () =>
         h.props!.onGridSizeChanged({ clientWidth: 900, clientHeight: 600 })
      );
      expect(hidden()).toEqual([]);
      expect(
         h.props!.columnDefs.find((column) => column.colId === "modified")?.hide
      ).toBe(false);
   });
});
