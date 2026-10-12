import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   state: { userId: "a", serverId: "old", setServerId: vi.fn() },
   push: vi.fn(),
   error: vi.fn(),
}));
vi.mock("react", () => ({ useCallback: (fn: unknown) => fn }));
vi.mock("next/router", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/lib/stores/session-store", () => ({
   default: { getState: () => h.state },
}));
vi.mock("@/lib/api", () => ({ errorMessage: String }));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { error: h.error },
}));
import { useSwitchServer } from "./useSwitchServer";

beforeEach(() => {
   vi.clearAllMocks();
   h.state.userId = "a";
   h.state.serverId = "old";
});

describe("server selection", () => {
   it("keeps the old target when navigation is declined", async () => {
      h.push.mockResolvedValue(false);
      await useSwitchServer()("new");
      expect(h.state.setServerId).not.toHaveBeenCalled();
   });
   it("changes the target only after guarded navigation completes", async () => {
      let finish!: (accepted: boolean) => void;
      h.push.mockReturnValue(
         new Promise<boolean>((resolve) => {
            finish = resolve;
         })
      );
      const switching = useSwitchServer()("new");
      expect(h.state.setServerId).not.toHaveBeenCalled();
      finish(true);
      await switching;
      expect(h.state.setServerId).toHaveBeenCalledWith("new");
   });
   it("does not switch a new account after pending navigation completes", async () => {
      h.push.mockImplementation(async () => {
         h.state = { ...h.state, userId: "b" };
         return true;
      });
      await useSwitchServer()("new");
      expect(h.state.setServerId).not.toHaveBeenCalled();
   });
   it("handles navigation errors without mutating the target", async () => {
      h.push.mockRejectedValue(new Error("Navigation failed"));
      await useSwitchServer()("new");
      expect(h.state.setServerId).not.toHaveBeenCalled();
      expect(h.error).toHaveBeenCalledOnce();
   });
});
