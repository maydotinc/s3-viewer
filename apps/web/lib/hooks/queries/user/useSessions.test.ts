import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryOptions = {
   queryKey: readonly unknown[];
   queryFn: () => Promise<{ id: string }[]>;
   enabled: boolean;
};

type MutationOptions = { mutationFn: (input: never) => Promise<void> };

const h = vi.hoisted(() => ({
   listSessions: vi.fn(),
   revokeSession: vi.fn(),
   query: null as unknown,
   mutations: [] as unknown[],
}));

vi.mock("react", () => ({
   useCallback: <T>(callback: T) => callback,
}));
vi.mock("@/lib/auth", () => ({
   listSessions: h.listSessions,
   revokeSession: h.revokeSession,
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
   useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
import { useRevokeSession, useSessions } from "./useSessions";

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
});

describe("listing sessions", () => {
   it("shows the most recent sign-in first", async () => {
      h.listSessions.mockResolvedValue([
         session("older", "2026-01-01T00:00:00.000Z"),
         session("newest", "2026-09-01T00:00:00.000Z"),
         session("middle", "2026-05-01T00:00:00.000Z"),
      ]);
      useSessions();
      const sessions = await query().queryFn();
      expect(h.listSessions).toHaveBeenCalledWith("signed-in-user");
      expect(sessions.map((entry) => entry.id)).toEqual([
         "newest",
         "middle",
         "older",
      ]);
   });

   it("surfaces the worded auth error", async () => {
      h.listSessions.mockRejectedValue(new Error("Session expired"));
      useSessions();
      await expect(query().queryFn()).rejects.toThrow("Session expired");
   });
});

describe("revoking sessions", () => {
   it("signs out one device by its token as the account that asked", async () => {
      useRevokeSession();
      await lastMutation().mutationFn(scoped({ token: "token-other" }));
      expect(h.revokeSession).toHaveBeenCalledWith(
         "token-other",
         "signed-in-user"
      );
   });

   it("does not report success when the revoke was refused", async () => {
      h.revokeSession.mockResolvedValue({ error: "Nope" });
      useRevokeSession();
      await expect(
         lastMutation().mutationFn(scoped({ token: "token-other" }))
      ).rejects.toThrow("Nope");
   });
});
