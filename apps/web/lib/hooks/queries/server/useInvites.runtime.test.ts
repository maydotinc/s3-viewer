// @vitest-environment happy-dom
import { api } from "@/lib/api";
import { deferred, flushRuntime, mountRuntime } from "@/lib/test/runtime";
import type { InvitesPage, ServerInvite } from "@s3-viewer/types";
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReceivedInvites } from "./useInvites";

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: vi.fn() },
}));
const page = (ids: string[], nextCursor: string | null): InvitesPage => ({
   invites: ids.map((id) => ({ id }) as ServerInvite),
   nextCursor,
});
let result!: ReturnType<typeof useReceivedInvites>;
let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
const settle = async () => {
   await flushRuntime();
   await flushRuntime();
};
beforeEach(() =>
   vi
      .mocked(api.get)
      .mockReset()
      .mockResolvedValue(page(["first"], "next"))
);
afterEach(async () => {
   await runtime?.unmount();
   runtime?.queryClient.clear();
   runtime = undefined;
   vi.unstubAllGlobals();
});

describe("on-demand received invites", () => {
   it("keeps available invites usable through a delayed page, failure, and retry", async () => {
      const Probe = () => {
         result = useReceivedInvites();
         return createElement(
            "output",
            null,
            result.invites.map(({ id }) => id).join(",")
         );
      };
      runtime = await mountRuntime(createElement(Probe));
      await settle();
      expect(result.isLoading).toBe(false);
      expect(result.invites.map(({ id }) => id)).toEqual(["first"]);
      expect(
         vi
            .mocked(api.get)
            .mock.calls.every(([url]) => url === "/invites?limit=100")
      ).toBe(true);
      const next = deferred<InvitesPage>();
      vi.mocked(api.get).mockImplementationOnce(async () => next.promise);
      let fetching!: Promise<unknown>;
      await act(async () => {
         fetching = result.fetchNextPage();
      });
      await settle();
      expect(result.isLoading).toBe(false);
      expect(result.isFetchingNextPage).toBe(true);
      expect(runtime.container.textContent).toBe("first");
      await act(async () => {
         next.reject(new Error("Later page failed"));
         await fetching;
      });
      await settle();
      expect(result.isFetchNextPageError).toBe(true);
      expect(runtime.container.textContent).toBe("first");
      vi.mocked(api.get).mockResolvedValueOnce(page(["second"], null));
      await act(async () => {
         await result.fetchNextPage();
      });
      await settle();
      expect(result.hasNextPage).toBe(false);
      expect(runtime.container.textContent).toBe("first,second");
   });
});
