import { MAX_PENDING_INVITES } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { exceedsPendingInviteCap } from "./invite-cap";

describe("exceedsPendingInviteCap", () => {
   it("allows filling exactly up to the cap", () => {
      expect(exceedsPendingInviteCap(0, MAX_PENDING_INVITES)).toBe(false);
      expect(exceedsPendingInviteCap(MAX_PENDING_INVITES - 1, 1)).toBe(false);
   });

   it("blocks a send that would cross the cap", () => {
      expect(exceedsPendingInviteCap(MAX_PENDING_INVITES, 1)).toBe(true);
      expect(exceedsPendingInviteCap(MAX_PENDING_INVITES - 1, 2)).toBe(true);
   });

   it("never blocks a send that creates no new invites, even over the cap", () => {
      expect(exceedsPendingInviteCap(MAX_PENDING_INVITES + 10, 0)).toBe(false);
   });
});
