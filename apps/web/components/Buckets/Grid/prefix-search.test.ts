// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime, typeInto } from "@/components/test-helpers";
import { LIST_INPUT_DEBOUNCE_MS } from "@/lib/constants";

const h = vi.hoisted(() => ({
   gridReady: true,
   filter: "",
   setFilter: vi.fn(),
   suggest: vi.fn((..._args: unknown[]) => ""),
}));

vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({ bucketName: "bucket", prefix: "logs/" }),
   useBucketFilter: () => ({ filter: h.filter, setFilter: h.setFilter }),
}));
vi.mock("@/components/DataGrid/context", () => ({
   useGridPaginationContext: () => ({ gridReady: h.gridReady }),
}));
vi.mock("@/lib/hooks/usePathSuggestion", () => ({
   usePathSuggestion: h.suggest,
}));
vi.mock("@/lib/shortcuts", () => ({ useShortcut: vi.fn() }));

import PrefixSearch from "./prefix-search";

const view = mountedRuntime();
const input = async () => {
   await view.mount(createElement(PrefixSearch));
   return view.current.container.querySelector("input")!;
};
const type = (field: HTMLInputElement, value: string) =>
   act(async () => typeInto(field, value));

beforeEach(() => {
   h.gridReady = true;
   h.filter = "";
   h.suggest.mockClear();
   h.setFilter.mockClear();
});

describe("prefix filter availability", () => {
   it("waits for the grid before the first filter", async () => {
      h.gridReady = false;
      expect((await input()).disabled).toBe(true);
   });

   it("stays editable when a filter replaced the grid, so it can be cleared", async () => {
      h.gridReady = false;
      h.filter = "..";
      expect((await input()).disabled).toBe(false);
   });
});

describe("filter suggestions", () => {
   it("reads completions from the grid's own listing instead of listing the prefix again", async () => {
      await type(await input(), "rep");
      expect(h.suggest).toHaveBeenLastCalledWith("bucket", "logs/rep", {
         cacheOnly: true,
      });
   });
});

describe("filter requests", () => {
   it("waits out the debounce and a second character before listing", async () => {
      vi.useFakeTimers();
      try {
         const field = await input();
         await type(field, "r");
         await act(async () => {
            await vi.advanceTimersByTimeAsync(LIST_INPUT_DEBOUNCE_MS * 2);
         });
         expect(h.setFilter).not.toHaveBeenCalled();

         await type(field, "re");
         await act(async () => {
            await vi.advanceTimersByTimeAsync(LIST_INPUT_DEBOUNCE_MS - 1);
         });
         expect(h.setFilter).not.toHaveBeenCalled();
         await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
         });
         expect(h.setFilter).toHaveBeenCalledExactlyOnceWith("re");
      } finally {
         vi.useRealTimers();
      }
   });

   it("drops the filter once the text falls below the minimum", async () => {
      vi.useFakeTimers();
      try {
         h.filter = "re";
         const field = await input();
         await type(field, "r");
         await act(async () => {
            await vi.advanceTimersByTimeAsync(LIST_INPUT_DEBOUNCE_MS);
         });
         expect(h.setFilter).toHaveBeenCalledExactlyOnceWith("");
      } finally {
         vi.useRealTimers();
      }
   });
});
