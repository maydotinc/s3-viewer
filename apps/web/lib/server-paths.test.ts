import { describe, expect, it } from "vitest";
import { auditPath, invitePeoplePath, membersPath } from "./server-paths";

describe("server paths", () => {
   it("escape the server id in every route", () => {
      expect(auditPath("a/b")).toBe("/servers/a%2Fb/audit");
      expect(invitePeoplePath("a&b")).toBe(
         "/settings/invites/new?server=a%26b"
      );
      expect(membersPath("a&b")).toBe("/settings/members?server=a%26b");
   });
});
