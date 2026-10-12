import { afterEach, describe, expect, it, vi } from "vitest";
import { Role } from "@s3-viewer/types";

vi.mock("@s3-viewer/ui/emails/server-invite", async (original) => ({
   ...(await original<typeof import("@s3-viewer/ui/emails/server-invite")>()),
   ServerInviteEmail: () => null,
}));
vi.mock("@s3-viewer/ui/emails/auth-link", async (original) => ({
   ...(await original<typeof import("@s3-viewer/ui/emails/auth-link")>()),
   AuthLinkEmail: () => null,
}));
vi.mock("@s3-viewer/ui/emails/account-deleted", async (original) => ({
   ...(await original<typeof import("@s3-viewer/ui/emails/account-deleted")>()),
   AccountDeletedEmail: () => null,
}));

const load = async (logBodies: boolean) => {
   vi.resetModules();
   const info = vi.spyOn(console, "info").mockImplementation(() => {});
   const email = await import("./index");
   email.configureEmail({ transport: "none", logBodies });
   return { email, lines: () => info.mock.calls.map(([line]) => String(line)) };
};

const sendOneOfEach = async (
   email: Awaited<ReturnType<typeof load>>["email"]
) => {
   await email.sendServerInviteEmail({
      to: "invitee@corp.example",
      inviterName: "Mallory Inviter",
      inviterEmail: "mallory@corp.example",
      serverName: "Payroll Archive",
      role: Role.VIEWER,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      invitesUrl: "https://app.example/settings/invites?invite=secret-token",
   });
   await email.sendAuthLinkEmail({
      to: "member@corp.example",
      intent: "reset",
      url: "https://api.example/auth/reset-password/secret-reset",
      expiresInHours: 1,
   });
   await email.sendAccountDeletedEmail({
      to: "gone@corp.example",
      name: "Gone Member",
      supportEmail: undefined,
   });
};

afterEach(() => {
   vi.restoreAllMocks();
});

describe("email with no transport", () => {
   it("refuses to send before it is configured", async () => {
      vi.resetModules();
      const email = await import("./index");
      await expect(
         email.sendAuthLinkEmail({
            to: "member@corp.example",
            intent: "reset",
            url: "https://api.example/auth/reset-password/secret-reset",
            expiresInHours: 1,
         })
      ).rejects.toThrow(/not configured/);
   });

   it("logs only the kind of each dropped message when bodies are off", async () => {
      const { email, lines } = await load(false);
      await sendOneOfEach(email);
      expect(lines()).toEqual([
         "[email] invite email dropped (transport none)",
         "[email] reset email dropped (transport none)",
         "[email] account-deleted email dropped (transport none)",
      ]);
   });

   it("prints the whole message when bodies are on so the link can be followed", async () => {
      const { email, lines } = await load(true);
      await sendOneOfEach(email);
      const [invite, reset] = lines();
      expect(invite).toContain(
         `to=invitee@corp.example subject="You've been invited to a server on S3 Viewer"`
      );
      expect(invite).toContain(
         "Invited by Mallory Inviter (mallory@corp.example)"
      );
      expect(invite).toContain("invite=secret-token");
      expect(reset).toContain("to=member@corp.example");
      expect(reset).toContain("secret-reset");
   });
});
