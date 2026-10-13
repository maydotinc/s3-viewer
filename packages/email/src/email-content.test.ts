import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@s3-viewer/types";
import type { EmailMessage } from "./delivery";

const sent = vi.hoisted(() => ({
   messages: [] as { message: EmailMessage; lane: string; retry?: boolean }[],
}));

vi.mock("./delivery", async (original) => ({
   ...(await original<typeof import("./delivery")>()),
   deliverEmail: async (
      _deliver: unknown,
      message: EmailMessage,
      options: { lane: string; retry?: boolean }
   ) => {
      sent.messages.push({ message, ...options });
   },
}));

const {
   configureEmail,
   sendAccountDeletedEmail,
   sendPasswordResetEmail,
   sendServerInviteEmail,
   sendVerificationCodeEmail,
} = await import("./index");

const SPOOFED_SERVER = "Verify account at bit.ly/xx \u202Egnp.exe\u202C";
const SPOOFED_INVITER = "S3 Viewer Security <security@evil.example>";
const LINKS = ["bit.ly", "/xx", "@evil"];
const BIDI = /[\u202A-\u202E\u2066-\u2069\u200B-\u200F]/;

const inviteMessage = async (overrides = {}) => {
   await sendServerInviteEmail({
      to: "victim@corp.example",
      inviterName: SPOOFED_INVITER,
      inviterEmail: "attacker@mail.example",
      serverName: SPOOFED_SERVER,
      role: Role.VIEWER,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      invitesUrl: "https://app.example/settings/invites?invite=secret-token",
      ...overrides,
   });
   const last = sent.messages.at(-1);
   if (!last) throw new Error("nothing sent");
   return last;
};

// the preview pads itself with zero-width characters, so only the body after it is checked.
const visibleHtml = (html: string): string => {
   const body = html
      .replace(/<[^>]*>/g, " ")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
   return body.slice(body.indexOf("You're invited"));
};

beforeEach(() => {
   sent.messages = [];
   configureEmail({ transport: "resend", resendKey: "test", logBodies: false });
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("invite email content", () => {
   it("keeps sender-chosen names out of the subject", async () => {
      const { message } = await inviteMessage();
      expect(message.subject).toBe(
         "You've been invited to a server on S3 Viewer"
      );
   });

   it("renders names without links, addresses or bidi controls in html and text", async () => {
      const { message } = await inviteMessage();
      const html = visibleHtml(message.html);
      for (const part of [message.text, html]) {
         for (const link of LINKS) expect(part).not.toContain(link);
         expect(part).not.toMatch(BIDI);
         expect(part).toContain("Verify account at [link] gnp.exe");
         expect(part).toContain("S3 Viewer Security <security[at]evil.ex…");
      }
   });

   it("names the inviter's real address so the recipient can judge it", async () => {
      const { message } = await inviteMessage();
      const expected =
         "Invited by S3 Viewer Security <security[at]evil.ex… (attacker@mail.example)";
      expect(message.text).toContain(expected);
      expect(visibleHtml(message.html)).toContain(expected);
   });

   it("keeps domain-like words that are not links", async () => {
      const { message } = await inviteMessage({
         serverName: "Node.js assets",
         inviterName: "prod.example.com",
      });
      expect(message.text).toContain("You're invited to Node.js assets");
      expect(message.text).toContain("Invited by prod.example.com (");
   });

   it.each(["evil.com/login", "www.evil.com", "https://evil.com"])(
      "replaces the link %s in a name",
      async (serverName) => {
         const { message } = await inviteMessage({ serverName });
         expect(message.text).toContain("You're invited to [link]");
         expect(message.text).not.toContain("evil.com");
      }
   );

   it("truncates long names and falls back when nothing printable is left", async () => {
      const { message } = await inviteMessage({
         serverName: "\u200B\u202E",
         inviterName: "x".repeat(80),
      });
      expect(message.text).toContain("You're invited to a server");
      expect(message.text).toContain(`Invited by ${"x".repeat(39)}…`);
   });

   it("sends invites on their own lane without retries", async () => {
      expect(await inviteMessage()).toMatchObject({
         lane: "invite",
         retry: false,
      });
   });
});

describe("other email lanes", () => {
   it("reserves the account lane for codes and reset links and retries them", async () => {
      await sendVerificationCodeEmail({
         to: "member@corp.example",
         code: "482913",
         expiresInMinutes: 10,
      });
      await sendPasswordResetEmail({
         to: "member@corp.example",
         url: "https://api.example/auth/reset-password/secret-reset",
         expiresInHours: 1,
      });
      await sendAccountDeletedEmail({
         to: "gone@corp.example",
         name: "Gone \u202Ewww.evil.example",
      });
      const [code, link, deleted] = sent.messages;
      expect(code).toMatchObject({ lane: "account", retry: true });
      expect(code?.message.subject).toBe(
         "482913 is your S3 Viewer verification code"
      );
      expect(code?.message.text).toContain("\n482913\n");
      expect(link).toMatchObject({ lane: "account", retry: true });
      expect(deleted).toMatchObject({ lane: "account", retry: false });
      expect(deleted?.message.subject).toBe(
         "Your S3 Viewer account has been deleted"
      );
      expect(deleted?.message.text).toContain("Hi Gone [link], your");
   });
});
