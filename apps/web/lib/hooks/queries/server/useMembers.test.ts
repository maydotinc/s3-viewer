import { queryKeys } from "@/lib/query-keys";
import {
   MAX_PAGE_SIZE,
   type MemberPage,
   type ServerUser,
} from "@s3-viewer/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Options = {
   queryKey: readonly unknown[];
   queryFn: (context: {
      pageParam: string | null;
      signal: AbortSignal;
   }) => Promise<unknown>;
   initialPageParam: string | null;
   enabled: boolean;
};

const h = vi.hoisted(() => ({
   get: vi.fn(),
   fetchNextPage: vi.fn(),
   options: null as unknown,
   result: {} as Record<string, unknown>,
   userId: "signed-in-user",
}));

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => h.userId }));
vi.mock("@tanstack/react-query", () => ({
   useInfiniteQuery: (options: unknown) => {
      h.options = options;
      return { fetchNextPage: h.fetchNextPage, ...h.result };
   },
}));
vi.mock("react", async (original) => ({
   ...(await original<typeof import("react")>()),
   useEffect: (effect: () => void) => effect(),
   useMemo: (factory: () => unknown) => factory(),
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get },
}));
import useMembers, { useAllMembers } from "./useMembers";

const signal = new AbortController().signal;

const member = (id: string): ServerUser =>
   ({ id, name: id, email: `${id}@example.com` }) as unknown as ServerUser;

const page = (ids: string[], nextCursor: string | null): MemberPage => ({
   members: ids.map(member),
   nextCursor,
});

const idle = {
   data: undefined,
   isLoading: false,
   error: null,
   hasNextPage: false,
   isFetchingNextPage: false,
};

const partial = () => ({
   ...idle,
   data: { pages: [page(["ann"], "next")] },
   hasNextPage: true,
});

const options = (): Options => h.options as Options;

beforeEach(() => {
   h.options = null;
   h.result = { ...idle };
   h.userId = "signed-in-user";
   h.get.mockReset();
   h.get.mockResolvedValue(page(["ann"], null));
   h.fetchNextPage.mockReset();
});

describe("the members list", () => {
   it("asks for the first page under the key mutations invalidate", async () => {
      useMembers("server-1");
      expect(options().queryKey).toEqual(
         queryKeys.members("signed-in-user", "server-1")
      );
      expect(options().initialPageParam).toBeNull();
      await options().queryFn({
         pageParam: options().initialPageParam,
         signal,
      });
      expect(h.get).toHaveBeenCalledWith(
         `/servers/server-1/members?limit=${MAX_PAGE_SIZE}`,
         signal
      );
   });

   it("stays idle until a server is picked", () => {
      useMembers("");
      expect(options().enabled).toBe(false);
      h.userId = "";
      useMembers("server-1");
      expect(options().enabled).toBe(false);
   });
});

describe("the filter's copy", () => {
   it("pulls the rest itself, since a menu has nowhere to put a button", () => {
      h.result = partial();
      useAllMembers("server-1");
      expect(h.fetchNextPage).toHaveBeenCalledExactlyOnceWith({
         cancelRefetch: false,
      });
   });

   it("stops pulling after a page fails instead of hammering the server", () => {
      h.result = { ...partial(), error: new Error("refused") };
      expect(useAllMembers("server-1").isLoading).toBe(false);
      expect(h.fetchNextPage).not.toHaveBeenCalled();
   });

   it("counts as loading until every option is in", () => {
      h.result = partial();
      expect(useAllMembers("server-1").isLoading).toBe(true);
      h.result = { ...idle, data: { pages: [page(["ann"], null)] } };
      expect(useAllMembers("server-1").isLoading).toBe(false);
   });
});
