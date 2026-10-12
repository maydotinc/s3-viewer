// @vitest-environment happy-dom
import type { S3Object } from "@s3-viewer/types";
import type { SelectionChangedEvent } from "ag-grid-community";
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
