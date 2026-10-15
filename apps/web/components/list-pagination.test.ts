// @vitest-environment happy-dom
import { act, createElement, type FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import ListPagination, { loadNext } from "./list-pagination";

const view = mountedRuntime();

describe("pagination inside a mutation form", () => {
   it("loads the next page without submitting the enclosing form", async () => {
      const submit = vi.fn((event: FormEvent) => event.preventDefault());
      const fetchNextPage = vi.fn().mockResolvedValue(undefined);
      await view.mount(
         createElement(
            "form",
            { onSubmit: submit },
            createElement(ListPagination, {
               hasNextPage: true,
               isFetching: false,
               isFetchNextPageError: false,
               error: null,
               fetchNextPage,
               refetch: vi.fn(),
            })
         )
      );
      await act(async () =>
         view.current.container.querySelector("button")!.click()
      );
      expect(fetchNextPage).toHaveBeenCalledOnce();
      expect(submit).not.toHaveBeenCalled();
   });
});

describe("choosing between the next page and a retry", () => {
   const query = (error: Error | null, isFetchNextPageError: boolean) => ({
      error,
      isFetchNextPageError,
      fetchNextPage: vi.fn().mockResolvedValue(undefined),
      refetch: vi.fn().mockResolvedValue(undefined),
   });

   it.each([
      ["loads the next page", null, false, "fetchNextPage"],
      [
         "retries a failed next page",
         new Error("Page failed"),
         true,
         "fetchNextPage",
      ],
      [
         "reloads after the list itself failed",
         new Error("List failed"),
         false,
         "refetch",
      ],
   ] as const)("%s", async (_name, error, isFetchNextPageError, expected) => {
      const paged = query(error, isFetchNextPageError);
      await loadNext(paged);
      const other = expected === "refetch" ? "fetchNextPage" : "refetch";
      expect(paged[expected]).toHaveBeenCalledExactlyOnceWith({
         cancelRefetch: false,
      });
      expect(paged[other]).not.toHaveBeenCalled();
   });
});
