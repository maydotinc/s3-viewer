import {
   AuditLevel,
   ErrorCode,
   Role,
   type AuditSettings,
   type AuditSettingsInput,
} from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Scope = { userId: string; serverId: string };
type Input = { variables: AuditSettingsInput; scope: Scope };
const scoped = (variables: AuditSettingsInput): Input => ({
   variables,
   scope: { userId: "signed-in-user", serverId: "server-1" },
});
type MutationOptions = {
   mutationFn: (input: Input) => Promise<AuditSettings>;
   onSuccess: (data: AuditSettings, input: Input) => Promise<void>;
   onError: (error: unknown, input: Input) => void;
};

const h = vi.hoisted(() => ({
   patch: vi.fn(),
   options: null as unknown,
   queryClient: {
      setQueryData: vi.fn(),
      setQueriesData: vi.fn(),
      invalidateQueries: vi.fn(),
   },
}));

vi.mock("react", () => ({
   useCallback: <T>(callback: T) => callback,
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: {
      getState: () => ({ userId: "signed-in-user", serverId: "server-1" }),
   },
   useUserId: () => "signed-in-user",
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
   useMutation: (options: unknown) => {
      h.options = options;
      return { isPending: false };
   },
   useQueryClient: () => h.queryClient,
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { patch: h.patch },
}));
import { ApiError } from "@/lib/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { queryKeys } from "@/lib/query-keys";
import { firstPageOnly } from "@/lib/hooks/queries/server/useAuditLog";
import useUpdateAuditSettings from "./useUpdateAuditSettings";

const saved = {
   enabled: true,
   viewRole: Role.ADMIN,
   manageRole: Role.OWNER,
   retentionDays: 90,
   level: AuditLevel.ALL,
} satisfies AuditSettings;

const options = (): MutationOptions => h.options as MutationOptions;

beforeEach(() => {
   h.options = null;
   h.patch.mockReset().mockResolvedValue({ settings: saved });
});

describe("saving audit settings", () => {
   it("sends exactly what the form hands it, without the server id", async () => {
      useUpdateAuditSettings();
      await options().mutationFn(
         scoped({ serverId: "server-1", enabled: false })
      );
      expect(h.patch).toHaveBeenCalledWith("/servers/server-1/audit/settings", {
         enabled: false,
      });
   });

   it("refreshes every activity filter from its first page only", async () => {
      useUpdateAuditSettings();
      await options().onSuccess(
         saved,
         scoped({ serverId: "server-1", enabled: false })
      );
      const logs = queryKeys.auditLogs("signed-in-user", "server-1");
      expect(h.queryClient.setQueriesData).toHaveBeenCalledWith(
         { queryKey: logs },
         firstPageOnly
      );
      expect(h.queryClient.invalidateQueries).toHaveBeenCalledWith({
         queryKey: logs,
      });
      expect(
         h.queryClient.setQueriesData.mock.invocationCallOrder[0]
      ).toBeLessThan(
         h.queryClient.invalidateQueries.mock.invocationCallOrder.at(-1)!
      );
   });

   it("leaves a stale sign-in to the form instead of toasting it", () => {
      useUpdateAuditSettings();
      const input = scoped({ serverId: "server-1", enabled: false });
      options().onError(
         new ApiError(403, "Sign in again", ErrorCode.SESSION_STALE),
         input
      );
      expect(toast.error).not.toHaveBeenCalled();
      options().onError(new ApiError(500, "Boom"), input);
      expect(toast.error).toHaveBeenCalledWith(
         "Couldn't save audit log settings",
         { description: "Boom" }
      );
   });
});
