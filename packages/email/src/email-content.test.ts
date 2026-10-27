import { beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_MS, INVITE_TTL_DAYS, Role } from "@s3-viewer/shared";
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

type InviteOverrides = Partial<
   Omit<Parameters<typeof sendServerInviteEmail>[0], "servers">
> & { serverName?: string; servers?: { serverName: string; role: Role }[] };

const inviteMessage = async ({
   serverName = SPOOFED_SERVER,
   servers = [{ serverName, role: Role.VIEWER }],
   ...overrides
}: InviteOverrides = {}) => {
   await sendServerInviteEmail({
      to: "victim@corp.example",
      inviterName: SPOOFED_INVITER,
      inviterEmail: "attacker@mail.example",
      servers,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS),
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

   it("lists every server with its role when one email covers several", async () => {
      const { message } = await inviteMessage({
         inviterName: "Pat Example",
         servers: [
            { serverName: "Payroll Archive", role: Role.VIEWER },
            { serverName: SPOOFED_SERVER, role: Role.ADMIN },
            { serverName: "Node.js assets", role: Role.EDITOR },
         ],
      });
      const html = visibleHtml(message.html);
      for (const part of [message.text, html]) {
         expect(part).toContain("You're invited to 3 servers");
         expect(part).toContain(
            "Pat Example invited you to 3 servers on S3 Viewer."
         );
         expect(part).toContain("Payroll Archive · Viewer");
         expect(part).toContain("Verify account at [link] gnp.exe · Admin");
         expect(part).toContain("Node.js assets · Editor");
         expect(part).toContain(
            "Invited by Pat Example (attacker@mail.example)"
         );
         expect(part).toContain(
            `These invitations expire in ${INVITE_TTL_DAYS} days.`
         );
         for (const link of LINKS) expect(part).not.toContain(link);
         expect(part).not.toMatch(BIDI);
      }
      expect(message.text).not.toContain("with Viewer access");
   });

   it("refuses an email that names no server", async () => {
      await expect(inviteMessage({ servers: [] })).rejects.toThrow(
         /needs a server/
      );
      expect(sent.messages).toEqual([]);
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
