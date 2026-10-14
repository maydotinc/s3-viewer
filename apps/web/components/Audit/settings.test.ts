// @vitest-environment happy-dom
import { act, createElement } from "react";
import {
   AuditLevel,
   ErrorCode,
   Role,
   type AuditSettings,
} from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, mountedRuntime } from "@/components/test-helpers";
import { ApiError } from "@/lib/api";
import Settings, { canToggleLog, settingsPayload } from "./settings";

const h = vi.hoisted(() => ({
   saved: null as unknown,
   error: null as unknown,
   signOut: vi.fn(),
}));

vi.mock("@/lib/hooks/queries/server/useAuditSettings", () => ({
   default: () => ({ data: h.saved, error: null, isFetching: false }),
}));
vi.mock("@/lib/hooks/mutations/server/useUpdateAuditSettings", () => ({
   default: () => ({ isPending: false, mutate: vi.fn(), error: h.error }),
}));
vi.mock("@/lib/auth", () => ({ signOut: h.signOut }));

const draft: AuditSettings = {
   enabled: true,
   viewRole: Role.ADMIN,
   manageRole: Role.ADMIN,
   retentionDays: 90,
   level: AuditLevel.CHANGES,
};

describe("what the settings form sends", () => {
   it("lets the owner change everything, the level included", () => {
      expect(settingsPayload("server-1", draft, true)).toEqual({
         serverId: "server-1",
         ...draft,
      });
   });

   it("lets a delegated admin change only whether the log is on", () => {
      expect(settingsPayload("server-1", draft, false)).toEqual({
         serverId: "server-1",
         enabled: true,
      });
   });
});

describe("who can switch the log off", () => {
   it("lets only the owner turn a running log off, as the API does", () => {
      expect(canToggleLog(draft, true)).toBe(true);
      expect(canToggleLog(draft, false)).toBe(false);
   });

   it("lets a delegated admin turn a stopped log back on", () => {
      expect(canToggleLog({ ...draft, enabled: false }, false)).toBe(true);
   });
});

describe("a stale sign-in", () => {
   const view = mountedRuntime();

   beforeEach(() => {
      h.saved = draft;
      h.error = null;
      h.signOut.mockReset();
   });

   it("offers a fresh sign-in where the save failed", async () => {
      await view.mount(
         createElement(Settings, { serverId: "server-1", myRole: Role.OWNER })
      );
      expect(view.text()).not.toContain("Sign in again");
      h.error = new ApiError(403, "Stale", ErrorCode.SESSION_STALE);
      await view.mount(
         createElement(Settings, { serverId: "server-1", myRole: Role.OWNER })
      );
      expect(view.text()).toContain("Sign in again to change these settings");
      await act(async () =>
         buttonByText(view.current.container, "Sign in again")!.click()
      );
      expect(h.signOut).toHaveBeenCalledOnce();
   });
});
