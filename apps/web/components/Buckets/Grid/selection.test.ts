// @vitest-environment happy-dom
import type { KnownReach } from "@/lib/utils/folder-access";
import type { S3Object } from "@s3-viewer/types";
import { act, createElement, type ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";

const h = vi.hoisted(() => ({
   reach: { folders: null, owner: false } as KnownReach,
   selected: new Set<string>(),
}));

vi.mock("@/components/DataGrid/context", () => ({
   useSelectionContext: () => ({ selectedIdSet: h.selected }),
}));
vi.mock("./grid-state", () => ({
   useObjectGridState: () => ({ reach: h.reach }),
}));

import { selectionColumn } from "./selection";

type Params = Record<string, unknown>;
const Cell = selectionColumn.cellRenderer as ComponentType<Params>;
const Header = selectionColumn.headerComponent as ComponentType<Params>;

const file = (key: string) =>
   ({ key, isFolder: false, eTag: '"e"', size: 1 }) as S3Object;

const node = (key: string) => {
   let selected = false;
   return {
      data: file(key),
      isSelected: () => selected,
      setSelected: (next: boolean) => {
         selected = next;
      },
   };
};

const gridApi = (rows: ReturnType<typeof node>[]) => ({
   addEventListener: vi.fn(),
   removeEventListener: vi.fn(),
   isDestroyed: () => false,
   paginationGetPageSize: () => 100,
   paginationGetCurrentPage: () => 0,
   getDisplayedRowAtIndex: (index: number) => rows[index],
   setNodesSelected: vi.fn(),
});

const view = mountedRuntime();
const mount = async (component: ComponentType<Params>, params: Params) => {
   await view.mount(createElement(component, params));
   return view.current.container;
};
const checkbox = (container: HTMLElement) =>
   container.querySelector<HTMLButtonElement>('[role="checkbox"]')!;

beforeEach(() => {
   h.reach = { folders: null, owner: false };
   h.selected = new Set();
});

describe("selecting rows the caller can't act on", () => {
   it("disables the checkbox on a dotted file for anyone but the owner", async () => {
      const dotted = {
         data: file("logs/../a.txt"),
         node: node("logs/../a.txt"),
      };
      expect(checkbox(await mount(Cell, dotted)).disabled).toBe(true);
      h.reach = { folders: null, owner: true };
      expect(checkbox(await mount(Cell, dotted)).disabled).toBe(false);
      h.reach = { folders: null, owner: false };
      expect(
         checkbox(
            await mount(Cell, {
               data: file("logs/a.txt"),
               node: node("logs/a.txt"),
            })
         ).disabled
      ).toBe(false);
   });

   it("leaves a blocked row out of select-all on the page", async () => {
      const rows = [node("logs/a.txt"), node("logs/../b.txt")];
      const api = gridApi(rows);
      const container = await mount(Header, { api });
      await act(async () => checkbox(container).click());
      expect(api.setNodesSelected).toHaveBeenCalledWith({
         nodes: [rows[0]],
         newValue: true,
      });
   });
});
