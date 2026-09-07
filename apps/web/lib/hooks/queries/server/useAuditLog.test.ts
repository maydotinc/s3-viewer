import { queryKeys } from "@/lib/queryKeys";
import type { AuditLogPage } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Options = {
   queryKey: readonly unknown[];
   queryFn: (context: { pageParam: string | null }) => Promise<AuditLogPage>;
   initialPageParam: string | null;
   getNextPageParam: (page: AuditLogPage) => string | null;
   enabled: boolean;
};

const h = vi.hoisted(() => ({
   get: vi.fn(),
   options: null as unknown,
   result: { data: undefined } as Record<string, unknown>,
}));

vi.mock("@/lib/stores/sessionStore", () => ({
   useUserId: () => "signed-in-user",
}));
vi.mock("@tanstack/react-query", () => ({
   useInfiniteQuery: (options: unknown) => {
      h.options = options;
      return h.result;
   },
}));
vi.mock("@/lib/api", () => ({
   api: { get: h.get },
   serverPath: (serverId: string) => `/servers/${serverId}`,
   qs: (params: Record<string, string | number | null | undefined>) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
         if (value !== undefined && value !== null && value !== "")
            search.set(key, String(value));
      }
      const query = search.toString();
      return query ? `?${query}` : "";
   },
}));
import useAuditLog from "./useAuditLog";

const page = (entries: number, nextCursor: string | null): AuditLogPage => ({
   entries: Array.from({ length: entries }, (_unused, index) => ({
      id: `${nextCursor ?? "last"}-${index}`,
      action: "member.remove" as const,
      actorId: "actor",
      actorEmail: "actor@example.com",
      actorName: "Actor",
      target: "someone@example.com",
      createdAt: "2026-09-06T00:00:00.000Z",
   })),
   nextCursor,
});

const options = (): Options => h.options as Options;

beforeEach(() => {
   h.options = null;
   h.result = { data: undefined };
   h.get.mockReset();
   h.get.mockResolvedValue(page(1, null));
});

describe("audit log paging", () => {
   it("asks for the first page with no cursor", async () => {
      useAuditLog("server-1", true);
      expect(options().queryKey).toEqual(
         queryKeys.auditLog("signed-in-user", "server-1")
      );
      expect(options().initialPageParam).toBeNull();
      await options().queryFn({ pageParam: options().initialPageParam });
      expect(h.get).toHaveBeenCalledWith("/servers/server-1/audit?limit=50");
   });

   it("percent-encodes the opaque cursor it was handed back", async () => {
      useAuditLog("server-1", true);
      await options().queryFn({ pageParam: "MjAyNi0wOS0wNnxpZA==" });
      expect(h.get).toHaveBeenCalledWith(
         "/servers/server-1/audit?cursor=MjAyNi0wOS0wNnxpZA%3D%3D&limit=50"
      );
   });

   it("follows nextCursor until the api stops sending one", () => {
      useAuditLog("server-1", true);
      expect(options().getNextPageParam(page(50, "next"))).toBe("next");
      expect(options().getNextPageParam(page(3, null))).toBeNull();
   });

   it("flattens the pages it has into one list, newest page first", () => {
      h.result = {
         data: { pages: [page(2, "next"), page(1, null)] },
      };
      const { entries } = useAuditLog("server-1", true);
      expect(entries.map((entry) => entry.id)).toEqual([
         "next-0",
         "next-1",
         "last-0",
      ]);
   });

   it("hands back a stable empty list before the first page lands", () => {
      const first = useAuditLog("server-1", true).entries;
      const second = useAuditLog("server-1", true).entries;
      expect(first).toHaveLength(0);
      expect(first).toBe(second);
   });
});

describe("when the log is fetched", () => {
   it("stays idle until its tab is opened", () => {
      useAuditLog("server-1", false);
      expect(options().enabled).toBe(false);
   });

   it("stays idle while no server is selected", () => {
      useAuditLog("", true);
      expect(options().enabled).toBe(false);
   });

   it("runs once the tab is open on a real server", () => {
      useAuditLog("server-1", true);
      expect(options().enabled).toBe(true);
   });
});
