// @vitest-environment happy-dom
import type { S3Object } from "@s3-viewer/types";
import type { GridApi, SelectionChangedEvent } from "ag-grid-community";
import { act, createElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import { GridProvider, useGridContext } from "./context";

let context!: ReturnType<typeof useGridContext>;
const Probe = () => {
   context = useGridContext();
   return null;
};

const view = mountedRuntime();
const select = async (nodes: { id: string; data?: Partial<S3Object> }[]) =>
   act(async () =>
      context.handlers.onSelectionChanged({
         api: { getSelectedNodes: () => nodes },
      } as unknown as SelectionChangedEvent<S3Object>)
   );

beforeEach(async () => {
   await view.mount(createElement(GridProvider, null, createElement(Probe)));
});

describe("reviewed selection snapshots", () => {
   it("retains the first reviewed version after eviction and replacement", async () => {
      const data = { key: "config.json", eTag: '"v1"', size: 8 };
      await select([{ id: data.key, data }]);
      data.eTag = '"v2"';
      data.size = 99;
      await select([{ id: data.key }]);
      expect(context.selectedObjects.get(data.key)).toEqual({
         key: data.key,
         eTag: '"v1"',
         size: 8,
      });
      await select([{ id: data.key, data }]);
      expect(context.selectedObjects.get(data.key)?.eTag).toBe('"v1"');
      await select([]);
      await select([{ id: data.key, data }]);
      expect(context.selectedObjects.get(data.key)?.eTag).toBe('"v2"');
   });

   it("follows the version a listing reload put on screen", async () => {
      const changed = { key: "a", eTag: '"v1"', size: 1 };
      const same = { key: "b", eTag: '"v1"', size: 2 };
      await select([
         { id: "a", data: changed },
         { id: "b", data: same },
         { id: "unloaded" },
      ]);
      const before = context.selectedObjects.get("b");
      const reloaded = [
         { id: "a", data: { ...changed, eTag: '"v2"', size: 5 } },
         { id: "b", data: same },
         { id: "unloaded" },
      ];
      await act(async () =>
         context.refreshSnapshots({
            getSelectedNodes: () => reloaded,
         } as unknown as GridApi)
      );
      expect(context.selectedObjects.get("a")).toEqual({
         key: "a",
         eTag: '"v2"',
         size: 5,
      });
      expect(context.selectedObjects.get("b")).toBe(before);
      expect(context.selectedObjects.get("unloaded")).toBeNull();
      // AG Grid delivers selection events late; one landing after the refresh keeps the new version
      await select(reloaded);
      expect(context.selectedObjects.get("a")?.eTag).toBe('"v2"');
   });

   it("keeps missing metadata explicitly unreviewed", async () => {
      await select([{ id: "missing" }]);
      expect(context.selectedIds).toEqual(["missing"]);
      expect(context.selectedObjects.get("missing")).toBeNull();
   });

   it.each(["clear", "destroy"])(
      "discards snapshots on %s without a live grid API",
      async (action) => {
         await select([{ id: "a", data: { key: "a", eTag: '"v1"', size: 1 } }]);
         await act(async () => {
            if (action === "clear") context.clearSelection();
            else context.handlers.onGridPreDestroyed();
         });
         expect(context.selectedObjects.size).toBe(0);
         expect(context.selectedIds).toEqual([]);
      }
   );
});
