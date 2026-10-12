import { queryKeys } from "@/lib/query-keys";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryOptions = {
   queryKey: readonly unknown[];
   queryFn: () => Promise<{ id: string }[]>;
   enabled: boolean;
};

type Scope = { userId: string; serverId: string };
type MutationOptions = {
   mutationFn: (input: never) => Promise<void>;
   onMutate: (input: { scope: Scope }) => Scope;
   onSuccess: (data: void, input: never, scope: Scope) => void;
};

const h = vi.hoisted(() => ({
   listSessions: vi.fn(),
   revokeSession: vi.fn(),
   revokeOtherSessions: vi.fn(),
   invalidateQueries: vi.fn(),
   query: null as unknown,
   mutations: [] as unknown[],
}));

vi.mock("react", () => ({
   useCallback: <T>(callback: T) => callback,
}));
vi.mock("@/lib/auth", () => ({
   accountFetchOptions: (userId: string) => ({
      headers: { "X-Expected-User-Id": userId },
   }),
   authClient: {
      listSessions: h.listSessions,
      revokeSession: h.revokeSession,
      revokeOtherSessions: h.revokeOtherSessions,
   },
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: { getState: () => ({ userId: "signed-in-user", serverId: "s1" }) },
   useUserId: () => "signed-in-user",
}));
vi.mock("@/lib/utils/toast", () => ({ toastError: () => () => undefined }));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
   useQuery: (options: unknown) => {
      h.query = options;
      return { data: undefined, isLoading: true, error: null };
   },
   useMutation: (options: unknown) => {
      h.mutations.push(options);
      return { isPending: false };
   },
   useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
}));
import {
   useRevokeOtherSessions,
   useRevokeSession,
   useSessions,
} from "./useSessions";

const session = (id: string, createdAt: string) => ({
   id,
   token: `token-${id}`,
   userId: "signed-in-user",
   createdAt: new Date(createdAt),
   updatedAt: new Date(createdAt),
   expiresAt: new Date("2026-12-31T00:00:00.000Z"),
});

const query = (): QueryOptions => h.query as QueryOptions;
const scope = { userId: "signed-in-user", serverId: "s1" };
const scoped = (variables?: unknown) => ({ variables, scope }) as never;
const lastMutation = (): MutationOptions =>
   h.mutations[h.mutations.length - 1] as MutationOptions;

beforeEach(() => {
   h.query = null;
   h.mutations = [];
   h.listSessions.mockReset();
   h.revokeSession.mockReset().mockResolvedValue({ error: null });
   h.revokeOtherSessions.mockReset().mockResolvedValue({ error: null });
   h.invalidateQueries.mockReset();
});

describe("listing sessions", () => {
   it("shows the most recent sign-in first", async () => {
      h.listSessions.mockResolvedValue({
         data: [
            session("older", "2026-01-01T00:00:00.000Z"),
            session("newest", "2026-09-01T00:00:00.000Z"),
            session("middle", "2026-05-01T00:00:00.000Z"),
         ],
         error: null,
      });
      useSessions();
      expect(query().queryKey).toEqual(queryKeys.sessions("signed-in-user"));
      const sessions = await query().queryFn();
      expect(h.listSessions).toHaveBeenCalledWith({
         fetchOptions: { headers: { "X-Expected-User-Id": "signed-in-user" } },
      });
      expect(sessions.map((entry) => entry.id)).toEqual([
         "newest",
         "middle",
         "older",
      ]);
   });

   it("surfaces what better-auth said went wrong", async () => {
      h.listSessions.mockResolvedValue({
         data: null,
         error: { message: "Session expired" },
      });
      useSessions();
      await expect(query().queryFn()).rejects.toThrow("Session expired");
   });

   it("falls back to the generic message when the error carries none", async () => {
      h.listSessions.mockResolvedValue({ data: null, error: {} });
      useSessions();
      await expect(query().queryFn()).rejects.toThrow(GENERIC_ERROR_MESSAGE);
   });
});

describe("revoking sessions", () => {
   it("signs out one device by its token and refetches the list", async () => {
      useRevokeSession();
      await lastMutation().mutationFn(scoped({ token: "token-other" }));
      expect(h.revokeSession).toHaveBeenCalledWith({
         token: "token-other",
         fetchOptions: { headers: { "X-Expected-User-Id": "signed-in-user" } },
      });
      lastMutation().onSuccess(undefined, scoped(), scope);
      expect(h.invalidateQueries).toHaveBeenCalledWith({
         queryKey: queryKeys.sessions("signed-in-user"),
      });
   });

   it("does not report success when the revoke was refused", async () => {
      h.revokeSession.mockResolvedValue({ error: { message: "Nope" } });
      useRevokeSession();
      await expect(
         lastMutation().mutationFn(scoped({ token: "token-other" }))
      ).rejects.toThrow("Nope");
   });

   it("signs out every other device and refetches the list", async () => {
      useRevokeOtherSessions();
      await lastMutation().mutationFn(scoped());
      expect(h.revokeOtherSessions).toHaveBeenCalled();
      lastMutation().onSuccess(undefined, scoped(), scope);
      expect(h.invalidateQueries).toHaveBeenCalledWith({
         queryKey: queryKeys.sessions("signed-in-user"),
      });
   });
});
