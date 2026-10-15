// @vitest-environment happy-dom
import {
   buttonByText,
   mountedRuntime,
   serverInfo,
} from "@/components/test-helpers";
import { Role } from "@s3-viewer/types";
import { act, createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import StepWhere from "./step-where";

vi.mock("next/link", () => ({
   default: ({ href, children }: { href: string; children: ReactNode }) =>
      createElement("a", { href }, children),
}));

const servers = [
   serverInfo({ id: "one", name: "Owned storage" }),
   serverInfo({ id: "two", name: "Admin storage", userRole: Role.ADMIN }),
];

const pages = (
   overrides: Partial<Parameters<typeof StepWhere>[0]["pages"]> = {}
) => ({
   hasNextPage: false,
   isFetching: false,
   error: null,
   isFetchNextPageError: false,
   fetchNextPage: async () => undefined,
   refetch: async () => undefined,
   ...overrides,
});

const view = mountedRuntime();
const mount = async (props: Partial<Parameters<typeof StepWhere>[0]> = {}) => {
   await view.mount(
      createElement(StepWhere, {
         servers,
         selected: new Set<string>(),
         loading: false,
         pages: pages(),
         onToggle: () => {},
         onSelectAll: () => {},
         ...props,
      })
   );
   return view.current.container;
};

describe("the server step", () => {
   it("lists each manageable server with its role", async () => {
      const container = await mount();
      expect(
         [...container.querySelectorAll("li")].map((item) => item.textContent)
      ).toEqual(["Owned storageOwner", "Admin storageAdmin"]);
      expect(container.querySelectorAll("[role=checkbox]")).toHaveLength(2);
   });

   it("selects every listed server at once, then clears them", async () => {
      const onSelectAll = vi.fn();
      const container = await mount({ onSelectAll });
      await act(async () => buttonByText(container, "Select all")!.click());
      expect(onSelectAll).toHaveBeenLastCalledWith(["one", "two"]);
      await mount({ onSelectAll, selected: new Set(["one", "two"]) });
      await act(async () =>
         buttonByText(view.current.container, "Clear")!.click()
      );
      expect(onSelectAll).toHaveBeenLastCalledWith([]);
   });

   it("holds the row height with skeletons while the list loads", async () => {
      const container = await mount({ servers: [], loading: true });
      expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
      expect(container.querySelectorAll("li[aria-hidden=true]")).toHaveLength(
         3
      );
      expect(
         buttonByText(container, "Select all")?.getAttribute("aria-hidden")
      ).toBe("true");
   });

   it("explains an empty list and offers the dashboard", async () => {
      const container = await mount({ servers: [] });
      expect(container.textContent).toContain("No servers you can invite to");
      expect(container.querySelector("a[href='/dashboard']")).not.toBeNull();
   });

   it("offers a retry when the list failed", async () => {
      const refetch = vi.fn().mockResolvedValue(undefined);
      const container = await mount({
         servers: [],
         pages: pages({ error: new Error("offline"), refetch }),
      });
      expect(container.textContent).toContain("Couldn't load your servers");
      await act(async () => buttonByText(container, "Try again")!.click());
      expect(refetch).toHaveBeenCalledOnce();
   });
});
