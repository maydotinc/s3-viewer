import { queryKeys } from "@/lib/query-keys";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Scope = { userId: string; serverId: string };
type MutationOptions = {
   onSuccess: (
      data: { id: string },
      input: unknown,
      scope: Scope
   ) => Promise<void>;
};

const h = vi.hoisted(() => ({
   state: { userId: "accountA", serverId: "serverA" },
   select: vi.fn(),
   push: vi.fn(),
   invalidate: vi.fn(),
   success: vi.fn(),
   options: null as unknown,
}));
vi.mock("react", () => ({
   useCallback: <T>(callback: T) => callback,
}));
vi.mock("next/router", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/lib/stores/session-store", () => ({
   default: { getState: () => ({ ...h.state, setServerId: h.select }) },
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: h.success, error: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
   useMutation: (options: unknown) => {
      h.options = options;
      return {};
   },
   useQueryClient: () => ({ invalidateQueries: h.invalidate }),
}));
vi.mock("@/lib/api", () => ({ api: {}, errorMessage: String }));
import useCreateServer from "./useCreateServer";

const start = () => {
   const options = h.options as MutationOptions;
   const scope = { ...h.state };
   return () =>
      options.onSuccess(
         { id: "createdServer" },
         { variables: {}, scope },
         scope
      );
};

beforeEach(() => {
   vi.clearAllMocks();
   h.state = { userId: "accountA", serverId: "serverA" };
   h.invalidate.mockResolvedValue(undefined);
   h.push.mockResolvedValue(true);
   h.select.mockImplementation((serverId: string) => {
      h.state = { ...h.state, serverId };
   });
   useCreateServer();
});

describe("connection completion keeps its original scope", () => {
   it("refreshes its account before selecting the new connection", async () => {
      await start()();
      expect(h.invalidate).toHaveBeenCalledWith({
         queryKey: queryKeys.servers("accountA"),
      });
      expect(h.select).toHaveBeenCalledWith("createdServer");
      expect(h.invalidate.mock.invocationCallOrder[0]).toBeLessThan(
         h.select.mock.invocationCallOrder[0]!
      );
      expect(h.success).toHaveBeenCalledWith("Server connected");
   });

   it.each([
      { userId: "accountB", serverId: "serverB" },
      { userId: "accountA", serverId: "anotherServer" },
   ])("leaves changed scope %j untouched during refresh", async (next) => {
      let finish!: () => void;
      h.invalidate.mockReturnValue(
         new Promise<void>((resolve) => {
            finish = resolve;
         })
      );
      const completion = start()();
      h.state = next;
      finish();
      await completion;
      expect(h.push).not.toHaveBeenCalled();
      expect(h.select).not.toHaveBeenCalled();
      expect(h.success).not.toHaveBeenCalled();
      expect(h.state).toEqual(next);
   });

   it("does not select or notify a different account during navigation", async () => {
      h.push.mockImplementation(async () => {
         h.state = { userId: "accountB", serverId: "serverB" };
         return true;
      });
      await start()();
      expect(h.success).not.toHaveBeenCalled();
   });
});
