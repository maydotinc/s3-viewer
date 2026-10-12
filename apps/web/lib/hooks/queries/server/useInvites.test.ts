import { queryKeys } from "@/lib/query-keys";
import { MAX_PAGE_SIZE, type ServerInvite } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvitesPage } from "./useInvites";

type Options = {
   queryKey: readonly unknown[];
   queryFn: (context: {
      pageParam: string | null;
      signal?: AbortSignal;
   }) => Promise<unknown>;
   initialPageParam: string | null;
   getNextPageParam: (page: InvitesPage) => string | null;
   enabled: boolean;
};

const h = vi.hoisted(() => ({
   get: vi.fn(),
   options: null as unknown,
   userId: "signed-in-user",
}));

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => h.userId }));
vi.mock("@tanstack/react-query", () => ({
   useInfiniteQuery: (options: unknown) => {
      h.options = options;
      return {};
   },
   useQuery: (options: unknown) => {
      h.options = options;
      return {};
   },
}));
vi.mock("react", async (original) => ({
   ...(await original<typeof import("react")>()),
   useMemo: (factory: () => unknown) => factory(),
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get },
}));
import { useAllSentInvites, useReceivedInvites } from "./useInvites";

const invite = (id: string): ServerInvite =>
   ({ id, email: `${id}@example.com` }) as unknown as ServerInvite;

const page = (ids: string[], nextCursor: string | null): InvitesPage => ({
   invites: ids.map(invite),
   nextCursor,
});

const options = (): Options => h.options as Options;

beforeEach(() => {
   h.options = null;
   h.userId = "signed-in-user";
   h.get.mockReset();
   h.get.mockResolvedValue(page(["one"], null));
});

describe("invites waiting for the signed-in user", () => {
   it("asks for the first page under the key mutations invalidate", async () => {
      useReceivedInvites();
      expect(options().queryKey).toEqual(
         queryKeys.receivedInvites("signed-in-user")
      );
      expect(options().initialPageParam).toBeNull();
      await options().queryFn({ pageParam: options().initialPageParam });
      expect(h.get).toHaveBeenCalledWith(
         `/invites?limit=${MAX_PAGE_SIZE}`,
         undefined
      );
   });

   it("percent-encodes the opaque cursor it was handed back", async () => {
      useReceivedInvites();
      await options().queryFn({ pageParam: "aW52aXRlfGlk==" });
      expect(h.get).toHaveBeenCalledWith(
         `/invites?cursor=aW52aXRlfGlk%3D%3D&limit=${MAX_PAGE_SIZE}`,
         undefined
      );
   });

   it("passes cancellation through the page request", async () => {
      useReceivedInvites();
      const signal = new AbortController().signal;
      await options().queryFn({ pageParam: null, signal });
      expect(h.get).toHaveBeenCalledWith(
         `/invites?limit=${MAX_PAGE_SIZE}`,
         signal
      );
   });

   it("stays idle with nobody signed in", () => {
      h.userId = "";
      useReceivedInvites();
      expect(options().enabled).toBe(false);
   });
});

describe("invites the user sent", () => {
   it("asks for a page, and follows the cursor it is given", async () => {
      useAllSentInvites();
      expect(options().queryKey).toEqual(
         queryKeys.sentInvitesAll("signed-in-user")
      );
      h.get.mockResolvedValue(page(["one"], "next"));
      await options().queryFn({ pageParam: null });
      expect(h.get).toHaveBeenCalledWith(
         `/invites/sent?limit=${MAX_PAGE_SIZE}`,
         undefined
      );
      expect(options().getNextPageParam(page(["one"], "next"))).toBe("next");
   });
});
