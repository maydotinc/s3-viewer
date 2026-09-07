import { queryKeys } from "@/lib/queryKeys";
import type { AuditAction, AuditLogPage } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

type InfiniteOptions = {
   queryKey: readonly unknown[];
   queryFn: (context: { pageParam: string | null }) => Promise<AuditLogPage>;
   getNextPageParam: (page: AuditLogPage) => string | null;
   enabled: boolean;
};

const h = vi.hoisted(() => ({
   get: vi.fn(),
   options: null as unknown,
   pages: [] as AuditLogPage[],
}));

vi.mock("@/lib/api", async () => {
   const actual =
      await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
   return { ...actual, api: { get: h.get } };
});
vi.mock("@/lib/stores/sessionStore", () => ({
   useUserId: () => "signed-in-user",
}));
vi.mock("@tanstack/react-query", () => ({
   useInfiniteQuery: (options: unknown) => {
      h.options = options;
      return {
         data: h.pages.length > 0 ? { pages: h.pages } : undefined,
         isLoading: false,
         error: null,
         hasNextPage: false,
         isFetchingNextPage: false,
         fetchNextPage: vi.fn(),
      };
   },
}));
import useSecurityActivity, { PAGE_SIZE } from "./useSecurityActivity";

const entry = (id: string, action: AuditAction) => ({
   id,
   action,
   actorId: "signed-in-user",
   actorEmail: "me@example.com",
   actorName: "Me",
   target: null,
   createdAt: "2026-09-06T12:00:00.000Z",
});

beforeEach(() => {
   h.get.mockReset().mockResolvedValue({ entries: [], nextCursor: null });
   h.pages = [];
   h.options = null;
});

const options = () => h.options as InfiniteOptions;

describe("useSecurityActivity", () => {
   it("reads the caller's own audit page and follows the cursor", async () => {
      useSecurityActivity();
      expect(options().queryKey).toEqual(
         queryKeys.securityActivity("signed-in-user")
      );
      expect(options().enabled).toBe(true);

      await options().queryFn({ pageParam: null });
      expect(h.get).toHaveBeenCalledWith(`/account/audit?limit=${PAGE_SIZE}`);

      await options().queryFn({ pageParam: "cursor123" });
      expect(h.get).toHaveBeenLastCalledWith(
         `/account/audit?cursor=cursor123&limit=${PAGE_SIZE}`
      );
      expect(
         options().getNextPageParam({ entries: [], nextCursor: "next456" })
      ).toBe("next456");
   });

   // the endpoint returns everything the caller did, servers included; this
   // card is only about the account
   it("keeps the account events and drops the server ones", () => {
      h.pages = [
         {
            entries: [
               entry("a", "auth.sign_in"),
               entry("b", "object.delete"),
               entry("c", "auth.password_change"),
               entry("d", "server.rename"),
               entry("e", "account.verify"),
            ],
            nextCursor: null,
         },
      ];
      expect(useSecurityActivity().entries.map((row) => row.id)).toEqual([
         "a",
         "c",
         "e",
      ]);
   });
});
