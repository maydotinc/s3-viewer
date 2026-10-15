import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   hasInAppHistory,
   installNavigationGuard,
   registerNavigationGuard,
} from "./navigation-guard";

const entry = (url: string) => ({
   url,
   state: { __N: true } as Record<string, unknown>,
});
let entries: ReturnType<typeof entry>[];
let position: number;
let pop: Parameters<
   Parameters<typeof installNavigationGuard>[0]["beforePopState"]
>[0];
let cleanup: () => void;
let release: () => void;
let confirm: ReturnType<typeof vi.fn<() => boolean>>;
let router: Parameters<typeof installNavigationGuard>[0];
const rendered = vi.fn();
const history = {
   get state() {
      return entries[position]!.state;
   },
   pushState: vi.fn(
      (
         state: Record<string, unknown>,
         _unused: string,
         url?: string | URL | null
      ) => {
         entries.splice(position + 1, entries.length, {
            state,
            url: String(url),
         });
         position++;
      }
   ),
   replaceState: vi.fn(
      (
         state: Record<string, unknown>,
         _unused: string,
         url?: string | URL | null
      ) => {
         entries[position] = {
            state,
            url: url == null ? entries[position]!.url : String(url),
         };
      }
   ),
   go: vi.fn((delta: number) => {
      position += delta;
      queueMicrotask(() => {
         if (pop(history.state as unknown as Parameters<typeof pop>[0]))
            rendered(entries[position]!.url);
      });
   }),
};
const go = async (delta: number) => {
   history.go(delta);
   await vi.runAllTimersAsync();
};

beforeEach(() => {
   vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
   vi.clearAllMocks();
   entries = [entry("/a")];
   position = 0;
   vi.stubGlobal("window", {
      history,
      location: {
         get href() {
            return entries[position]!.url;
         },
      },
   });
   router = {
      beforePopState: (listener) => {
         pop = listener;
      },
      push: vi.fn(async (url) => {
         history.pushState({ __N: true }, "", String(url));
         rendered(url);
         return true;
      }),
      replace: vi.fn(async (url) => {
         history.replaceState({ __N: true }, "", String(url));
         rendered(url);
         return true;
      }),
   };
   cleanup = installNavigationGuard(router);
   confirm = vi.fn(() => true);
   release = registerNavigationGuard(confirm);
});
afterEach(() => {
   release();
   cleanup();
   vi.unstubAllGlobals();
   vi.useRealTimers();
});

describe("guarded navigation", () => {
   it("resolves false without changing route or URL when a push or replace is declined", async () => {
      confirm.mockReturnValue(false);
      await expect(router.push("/b")).resolves.toBe(false);
      await expect(router.replace("/c")).resolves.toBe(false);
      expect(entries.map(({ url }) => url)).toEqual(["/a"]);
      expect(rendered).not.toHaveBeenCalled();
   });

   it("restores Back and Forward repeatedly without creating or overwriting history entries", async () => {
      await router.push("/b");
      await router.push("/c");
      await go(-1);
      rendered.mockClear();
      confirm.mockReturnValue(false);
      await go(-1);
      expect(position).toBe(1);
      await go(-1);
      expect(position).toBe(1);
      await go(1);
      expect(position).toBe(1);
      expect(entries.map(({ url }) => url)).toEqual(["/a", "/b", "/c"]);
      expect(rendered).not.toHaveBeenCalled();
      confirm.mockReturnValue(true);
      await go(1);
      expect(position).toBe(2);
      expect(rendered).toHaveBeenLastCalledWith("/c");
      await go(-2);
      expect(position).toBe(0);
      expect(rendered).toHaveBeenLastCalledWith("/a");
   });

   it("does not ask again for the restoration popstate", async () => {
      await router.push("/b");
      confirm.mockClear().mockReturnValue(false);
      await go(-1);
      expect(confirm).toHaveBeenCalledOnce();
      expect(position).toBe(1);
   });

   it("blocks push and replace while rejected history navigation is being restored", async () => {
      await router.push("/b");
      confirm.mockReturnValue(false);
      history.go(-1);
      await Promise.resolve();
      confirm.mockReturnValue(true);
      await expect(router.push("/wrong")).resolves.toBe(false);
      await expect(router.replace("/wrong")).resolves.toBe(false);
      await vi.runAllTimersAsync();
      expect(entries[position]!.url).toBe("/b");
      await expect(router.push("/c")).resolves.toBe(true);
   });

   it("preserves the current draft route when a legacy unindexed entry is declined", async () => {
      await router.push("/b");
      entries[0]!.state = { __N: true };
      confirm.mockReturnValue(false);
      rendered.mockClear();
      await go(-1);
      expect(entries[position]!.url).toBe("/b");
      expect(rendered).not.toHaveBeenCalled();
      confirm.mockReturnValue(true);
      await go(-1);
      expect(entries[position]!.url).toBe("/a");
      expect(rendered).toHaveBeenCalledWith("/a");
   });

   it("stops asking once the guard is released", async () => {
      await router.push("/b");
      release();
      confirm.mockReturnValue(false);
      await expect(router.push("/c")).resolves.toBe(true);
      await go(-1);
      expect(position).toBe(1);
   });
});

describe("whether Back stays in the app", () => {
   it("is true after navigating inside the app, and false again back at the start", async () => {
      await router.push("/b");
      expect(hasInAppHistory()).toBe(true);
      await go(-1);
      expect(hasInAppHistory()).toBe(false);
   });

   it("is false for an entry the guard never stamped", () => {
      entries = [entry("/elsewhere")];
      position = 0;
      expect(hasInAppHistory()).toBe(false);
   });
});
