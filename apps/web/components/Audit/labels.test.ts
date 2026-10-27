import type { AuditLogEntry } from "@s3-viewer/shared";
import { describe, expect, it } from "vitest";
import { ACTION_FAMILY_LABELS, ACTION_LABELS, metaOf } from "./labels";

const refusal = (detail: AuditLogEntry["detail"]) =>
   metaOf({ action: "access.denied", detail } as AuditLogEntry);

describe("a refused action in the activity log", () => {
   it("says what was tried and why it was refused", () => {
      expect(
         refusal({ permission: "DELETE_SERVER", reason: "forbidden" })
      ).toBe("tried to delete the server · role too low");
   });

   it("marks a refusal whose request did not provably come from the app", () => {
      expect(
         refusal({
            permission: "DELETE_SERVER",
            reason: "forbidden",
            unverifiedOrigin: true,
         })
      ).toBe(
         "tried to delete the server · role too low · request origin not verified"
      );
   });
});

describe("access removed as a side effect", () => {
   const meta = (action: AuditLogEntry["action"], reason?: string) =>
      metaOf({
         action,
         detail: reason === undefined ? null : { reason },
      } as AuditLogEntry);

   it("explains an invite revoked because its sender lost the authority to grant it", () => {
      expect(meta("invite.revoke", "sender_authority")).toBe(
         "sender can no longer grant this access"
      );
   });

   it("explains departures and revoked invites caused by a deleted account", () => {
      expect(meta("server.leave", "account_deleted")).toBe("account deleted");
      expect(meta("invite.revoke", "account_deleted")).toBe("account deleted");
   });

   it("adds nothing to a direct revoke or an ordinary departure", () => {
      expect(meta("invite.revoke")).toBeNull();
      expect(meta("server.leave")).toBeNull();
      expect(meta("invite.revoke", "something-new")).toBeNull();
   });
});

describe("the action filter", () => {
   it("has a family for every action the log records", () => {
      const families = Object.keys(ACTION_FAMILY_LABELS);
      const unreachable = Object.keys(ACTION_LABELS).filter(
         (action) => !families.some((family) => action.startsWith(`${family}.`))
      );
      expect(unreachable).toEqual([]);
   });
});

describe("writes whose outcome the log qualifies", () => {
   const meta = (
      action: AuditLogEntry["action"],
      detail: AuditLogEntry["detail"]
   ) => metaOf({ action, detail } as AuditLogEntry);

   it("marks a write storage may not have completed", () => {
      expect(
         meta("object.copy", { to: "b.txt", size: 4, confirmed: false })
      ).toBe("unconfirmed · → b.txt · 4 B");
      expect(meta("object.upload", { confirmed: false })).toBe("unconfirmed");
   });

   it("tells adding an existing bucket apart from creating one", () => {
      expect(meta("bucket.create", { existing: true, clearedGrants: 2 })).toBe(
         "added an existing bucket · cleared 2 earlier grants"
      );
      expect(meta("bucket.create", { clearedGrants: 1 })).toBe(
         "cleared 1 earlier grant"
      );
   });
});
