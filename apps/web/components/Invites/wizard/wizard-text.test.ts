import { sentInvite as invite } from "@/components/test-helpers";
import { Role, type InviteOutcome } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import {
   accessStatus,
   peopleText,
   resultTitle,
   sendLabel,
   stepAnnouncement,
   unemailedAddresses,
   unemailedText,
   wizardSteps,
} from "./wizard-text";

const outcome = (
   serverId: string,
   overrides: Partial<InviteOutcome> = {}
): InviteOutcome => ({
   serverId,
   invites: [],
   alreadyMembers: [],
   error: null,
   ...overrides,
});

describe("the steps", () => {
   it("announces the position in the flow that is actually shown", () => {
      expect(stepAnnouncement(wizardSteps(true), "where")).toBe(
         "Step 2 of 4, Where"
      );
      expect(stepAnnouncement(wizardSteps(false), "access")).toBe(
         "Step 2 of 3, Access"
      );
   });
});

describe("the context line", () => {
   it("names the first person and counts the rest", () => {
      expect(peopleText(["a@x.com"])).toBe("a@x.com");
      expect(peopleText(["a@x.com", "b@x.com"])).toBe("a@x.com and 1 other");
      expect(peopleText(["a@x.com", "b@x.com", "c@x.com"])).toBe(
         "a@x.com and 2 others"
      );
   });
});

describe("the send button", () => {
   it("counts people, and servers only when there are several", () => {
      expect(sendLabel(true, 1, 1)).toBe("Send invite");
      expect(sendLabel(true, 3, 1)).toBe("Send 3 invites");
      expect(sendLabel(true, 3, 2)).toBe("Send 3 invites to 2 servers");
      expect(sendLabel(true, 1, 2)).toBe("Send invite to 2 servers");
   });
});

describe("a server's status line", () => {
   it("counts buckets, or says all when every grantable one is in", () => {
      const base = { grantable: 3, noBuckets: false, problem: null };
      expect(accessStatus({ ...base, role: Role.EDITOR, checked: 1 })).toEqual({
         text: "Editor · 1 bucket",
         tone: "set",
      });
      expect(accessStatus({ ...base, role: Role.ADMIN, checked: 3 })).toEqual({
         text: "Admin · all buckets",
         tone: "set",
      });
   });

   it("puts a problem first, in red", () => {
      expect(
         accessStatus({
            role: Role.VIEWER,
            checked: 0,
            grantable: 2,
            noBuckets: false,
            problem: "Choose at least one bucket",
         })
      ).toEqual({ text: "Choose at least one bucket", tone: "error" });
   });
});

describe("the result headline", () => {
   it("depends on how many servers refused", () => {
      expect(resultTitle([outcome("a"), outcome("b")], true)).toBe(
         "Invites sent"
      );
      expect(resultTitle([outcome("a")], false)).toBe("Invites saved");
      expect(
         resultTitle([outcome("a"), outcome("b", { error: "Full" })], true)
      ).toBe("Sent to 1 of 2 servers");
      expect(resultTitle([outcome("a", { error: "Full" })], true)).toBe(
         "Couldn't send invites"
      );
   });
});

describe("the result rows", () => {
   it("collects the addresses no email went to, once each", () => {
      const outcomes = [
         outcome("a", {
            invites: [invite("a@x.com", false), invite("b@x.com")],
         }),
         outcome("b", { invites: [invite("a@x.com", false)] }),
      ];
      expect(unemailedAddresses(outcomes)).toEqual(["a@x.com"]);
      expect(unemailedText(["a@x.com", "b@x.com"])).toContain(
         "those addresses"
      );
   });
});
