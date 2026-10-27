import { queryKeys } from "@/lib/query-keys";
import type { AuditLogPage } from "@s3-viewer/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Options = {
   queryKey: readonly unknown[];
   queryFn: (context: {
      pageParam: string | null;
      signal: AbortSignal;
   }) => Promise<AuditLogPage>;
   initialPageParam: string | null;
   enabled: boolean;
   refetchOnWindowFocus: boolean;
   placeholderData: (
      previous: unknown,
      previousQuery: { queryKey: readonly unknown[] } | undefined
   ) => unknown;
};

const h = vi.hoisted(() => ({
   get: vi.fn(),
   resetQueries: vi.fn(),
   setQueryData: vi.fn(),
   options: null as unknown,
   result: { data: undefined, error: null } as Record<string, unknown>,
}));

vi.mock("@/lib/stores/session-store", () => ({
   useUserId: () => "signed-in-user",
}));
vi.mock("@tanstack/react-query", () => ({
   useInfiniteQuery: (options: unknown) => {
      h.options = options;
      return h.result;
   },
   useQueryClient: () => ({
      resetQueries: h.resetQueries,
      setQueryData: h.setQueryData,
   }),
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
import { ApiError, qs } from "@/lib/api";
import useAuditLog from "./useAuditLog";

const signal = new AbortController().signal;

const page = (entries: number, nextCursor: string | null): AuditLogPage => ({
   entries: Array.from({ length: entries }, (_unused, index) => ({
      id: `${nextCursor ?? "last"}-${index}`,
      action: "member.remove" as const,
      actorId: "actor",
      actorEmail: "actor@example.com",
      bucket: null,
      target: "someone@example.com",
      detail: null,
      createdAt: "2026-09-06T00:00:00.000Z",
   })),
   nextCursor,
});

const options = (): Options => h.options as Options;

beforeEach(() => {
   h.options = null;
   h.result = { data: undefined, error: null };
   h.get.mockReset();
   h.get.mockResolvedValue(page(1, null));
   h.resetQueries.mockReset();
   h.setQueryData.mockReset();
});

describe("audit log paging", () => {
   it("asks for the first page with no cursor", async () => {
      useAuditLog("server-1", {});
      expect(options().queryKey).toEqual(
         queryKeys.auditLog("signed-in-user", "server-1", {})
      );
      expect(options().initialPageParam).toBeNull();
      await options().queryFn({
         pageParam: options().initialPageParam,
         signal,
      });
      expect(h.get).toHaveBeenCalledWith(
         "/servers/server-1/audit?limit=50",
         signal
      );
   });

   it("percent-encodes the opaque cursor it was handed back", async () => {
      useAuditLog("server-1", {});
      await options().queryFn({ pageParam: "MjAyNi0wOS0wNnxpZA==", signal });
      expect(h.get).toHaveBeenCalledWith(
         "/servers/server-1/audit?cursor=MjAyNi0wOS0wNnxpZA%3D%3D&limit=50",
         signal
      );
   });

   it("hands back a stable empty list before the first page lands", () => {
      const first = useAuditLog("server-1", {}).entries;
      const second = useAuditLog("server-1", {}).entries;
      expect(first).toHaveLength(0);
      expect(first).toBe(second);
   });

   it("never refetches on focus, since every uncursored read is recorded", () => {
      useAuditLog("server-1", {});
      expect(options().refetchOnWindowFocus).toBe(false);
   });

   it("keeps the last rows on screen while a new filter loads, within one server only", () => {
      useAuditLog("server-1", { q: "next" });
      const keep = options().placeholderData;
      const previous = { pages: [page(1, null)], pageParams: [null] };
      const from = (queryKey: readonly unknown[]) => ({ queryKey });
      expect(
         keep(previous, from(queryKeys.auditLog("signed-in-user", "server-1")))
      ).toBe(previous);
      expect(
         keep(previous, from(queryKeys.auditLog("signed-in-user", "server-2")))
      ).toBeUndefined();
      expect(
         keep(previous, from(queryKeys.auditLog("someone-else", "server-1")))
      ).toBeUndefined();
      expect(keep(undefined, undefined)).toBeUndefined();
   });
});

describe("filters", () => {
   it("keys the cache by the filters that are set and sends them along", async () => {
      const picked = {
         action: "object",
         actor: "user-2",
         bucket: "photos",
         q: "2026/",
         preset: "custom" as const,
         from: "2026-09-01",
         to: "2026-09-03",
      };
      useAuditLog("server-1", picked);
      expect(options().queryKey).toEqual(
         queryKeys.auditLog("signed-in-user", "server-1", picked)
      );
      await options().queryFn({ pageParam: null, signal });
      expect(h.get).toHaveBeenCalledWith(
         `/servers/server-1/audit${qs({
            limit: 50,
            action: "object",
            actor: "user-2",
            bucket: "photos",
            q: "2026/",
            from: new Date("2026-09-01T00:00:00.000").toISOString(),
            to: new Date("2026-09-03T23:59:59.999").toISOString(),
         })}`,
         signal
      );
   });

   it("resolves a relative preset when each page is asked for, not when it was picked", async () => {
      vi.useFakeTimers();
      try {
         vi.setSystemTime(Date.UTC(2026, 8, 7, 12));
         useAuditLog("server-1", { preset: "24h" });
         vi.setSystemTime(Date.UTC(2026, 8, 8, 12));
         await options().queryFn({ pageParam: "next", signal });
         expect(h.get).toHaveBeenCalledWith(
            "/servers/server-1/audit?cursor=next&limit=50&from=2026-09-07T12%3A00%3A00.000Z",
            signal
         );
      } finally {
         vi.useRealTimers();
      }
   });

   it("treats a cleared filter the same as one never set", () => {
      useAuditLog("server-1", { action: "", q: "", from: "", to: undefined });
      expect(options().queryKey).toEqual(
         queryKeys.auditLog("signed-in-user", "server-1", {})
      );
   });
});

describe("a cursor the api refuses", () => {
   const badCursor = new ApiError(400, "Invalid cursor", "VALIDATION");

   it("starts the list over instead of showing the error", () => {
      h.result = { data: { pages: [page(1, "stale")] }, error: badCursor };
      useAuditLog("server-1", {});
      expect(h.resetQueries).toHaveBeenCalledWith({
         queryKey: queryKeys.auditLog("signed-in-user", "server-1", {}),
         exact: true,
      });
   });

   it("still surfaces a first page the api refused", () => {
      h.result = { data: undefined, error: badCursor };
      expect(useAuditLog("server-1", {}).error).toBe(badCursor);
      expect(h.resetQueries).not.toHaveBeenCalled();
   });

   it("leaves other errors alone", () => {
      h.result = {
         data: { pages: [page(1, null)] },
         error: new ApiError(403, "Forbidden", "FORBIDDEN"),
      };
      useAuditLog("server-1", {});
      expect(h.resetQueries).not.toHaveBeenCalled();
   });
});

describe("refresh", () => {
   it("drops every page but the first before refetching, so it costs one read", async () => {
      const refetch = vi.fn().mockResolvedValue(undefined);
      h.result = { data: undefined, error: null, refetch };
      await useAuditLog("server-1", {}).refresh();
      expect(h.setQueryData).toHaveBeenCalledWith(
         queryKeys.auditLog("signed-in-user", "server-1", {}),
         expect.any(Function)
      );
      const trim = h.setQueryData.mock.calls[0]![1] as (
         current: unknown
      ) => unknown;
      expect(
         trim({
            pages: [page(1, "b"), page(1, "c"), page(1, null)],
            pageParams: [null, "b", "c"],
         })
      ).toEqual({ pages: [page(1, "b")], pageParams: [null] });
      expect(trim(undefined)).toBeUndefined();
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(h.setQueryData.mock.invocationCallOrder[0]).toBeLessThan(
         refetch.mock.invocationCallOrder[0]!
      );
   });
});

describe("when the log is fetched", () => {
   it("stays idle while no server is selected", () => {
      useAuditLog("", {});
      expect(options().enabled).toBe(false);
   });
});
