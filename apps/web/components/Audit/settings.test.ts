import { AuditLevel, Role, type AuditSettings } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { canToggleLog, settingsPayload } from "./settings";

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
