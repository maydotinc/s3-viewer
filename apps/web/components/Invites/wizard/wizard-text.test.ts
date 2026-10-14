import { Role, type InviteOutcome, type SentInvite } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import {
   accessStatus,
   alreadyMembersText,
   contextLine,
   invitedText,
   peopleText,
   resultTitle,
   sendLabel,
   serversText,
   stepAnnouncement,
   unemailedAddresses,
   unemailedText,
   wizardSteps,
} from "./wizard-text";

const invite = (email: string, emailed = true): SentInvite => ({
   id: email,
   email,
   emailed,
   role: Role.VIEWER,
   expiresAt: "2099-01-01T00:00:00Z",
   server: { id: "server", name: "Storage" },
   invitedBy: { name: "Me", email: "me@example.com" },
   bucketAccess: [],
});

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
   it("drops Where when there is only one server to invite to", () => {
      expect(wizardSteps(true)).toEqual(["who", "where", "access", "review"]);
      expect(wizardSteps(false)).toEqual(["who", "access", "review"]);
   });

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

   it("names one server and counts several", () => {
      expect(serversText(["Backups"])).toBe("Backups");
      expect(serversText(["Backups", "Media"])).toBe("2 servers");
   });

   it("summarises the earlier steps on each later step", () => {
      expect(contextLine("who", [], [])).toContain("Invites expire after");
      expect(contextLine("where", ["a@x.com"], [])).toBe("Inviting a@x.com");
      expect(contextLine("access", ["a@x.com", "b@x.com"], ["Backups"])).toBe(
         "Inviting a@x.com and 1 other to Backups"
      );
      expect(contextLine("review", ["a@x.com"], ["Backups", "Media"])).toBe(
         "Inviting a@x.com to 2 servers"
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

   it("saves instead of sending when email is off", () => {
      expect(sendLabel(false, 2, 3)).toBe("Save 2 invites to 3 servers");
   });
});

describe("a server's status line", () => {
   it("says when nothing is chosen yet", () => {
      expect(
         accessStatus({
            role: Role.VIEWER,
            checked: 0,
            grantable: 3,
            noBuckets: false,
            problem: null,
         })
      ).toEqual({ text: "Not set up yet", tone: "muted" });
   });

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

   it("says when the server has nothing to share", () => {
      expect(
         accessStatus({
            role: Role.VIEWER,
            checked: 0,
            grantable: 0,
            noBuckets: true,
            problem: null,
         })
      ).toEqual({ text: "No buckets to share", tone: "muted" });
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
   it("lists who was invited and who was already in", () => {
      expect(invitedText(["a@x.com", "b@x.com"])).toBe(
         "Invited a@x.com and b@x.com"
      );
      expect(alreadyMembersText(["a@x.com"])).toBe(
         "a@x.com is already a member"
      );
      expect(alreadyMembersText(["a@x.com", "b@x.com"])).toBe(
         "a@x.com and b@x.com are already members"
      );
   });

   it("collects the addresses no email went to, once each", () => {
      const outcomes = [
         outcome("a", {
            invites: [invite("a@x.com", false), invite("b@x.com")],
         }),
         outcome("b", { invites: [invite("a@x.com", false)] }),
      ];
      expect(unemailedAddresses(outcomes)).toEqual(["a@x.com"]);
      expect(unemailedText(["a@x.com"])).toBe(
         "Saved, but no email went to a@x.com. Ask them to sign in with that address and open Settings, Invites."
      );
      expect(unemailedText(["a@x.com", "b@x.com"])).toContain(
         "those addresses"
      );
   });
});
