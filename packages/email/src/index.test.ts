import { afterEach, describe, expect, it, vi } from "vitest";
import { Role } from "@s3-viewer/types";

vi.mock("@s3-viewer/ui/emails/server-invite", async (original) => ({
   ...(await original<typeof import("@s3-viewer/ui/emails/server-invite")>()),
   ServerInviteEmail: () => null,
}));
vi.mock("@s3-viewer/ui/emails/password-reset", async (original) => ({
   ...(await original<typeof import("@s3-viewer/ui/emails/password-reset")>()),
   PasswordResetEmail: () => null,
}));
vi.mock("@s3-viewer/ui/emails/account-deleted", async (original) => ({
   ...(await original<typeof import("@s3-viewer/ui/emails/account-deleted")>()),
   AccountDeletedEmail: () => null,
}));

const callsOf = (spy: { mock: { calls: unknown[][] } }) => () =>
   spy.mock.calls.map(
      ([message, meta]): Record<string, string> => ({
         message: String(message),
         ...(meta as Record<string, string>),
      })
   );

const load = async (logBodies: boolean) => {
   vi.resetModules();
   const info = vi.spyOn(console, "info").mockImplementation(() => {});
   const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
   const email = await import("./index");
   email.configureEmail({ transport: "none", logBodies });
   return { email, infos: callsOf(info), warnings: callsOf(warn) };
};

const sendOneOfEach = async (
   email: Awaited<ReturnType<typeof load>>["email"]
) => {
   await email.sendServerInviteEmail({
      to: "invitee@corp.example",
      inviterName: "Mallory Inviter",
      inviterEmail: "mallory@corp.example",
      servers: [{ serverName: "Payroll Archive", role: Role.VIEWER }],
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      invitesUrl: "https://app.example/settings/invites?invite=secret-token",
   });
   await email.sendPasswordResetEmail({
      to: "member@corp.example",
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
         email.sendPasswordResetEmail({
            to: "member@corp.example",
            url: "https://api.example/auth/reset-password/secret-reset",
            expiresInHours: 1,
         })
      ).rejects.toThrow(/not configured/);
   });

   it("warns with only the kind of each dropped message when bodies are off", async () => {
      const { email, infos, warnings } = await load(false);
      await sendOneOfEach(email);
      const dropped = "Email dropped (transport none)";
      expect(infos()).toEqual([]);
      expect(warnings()).toEqual([
         { message: dropped, kind: "invite" },
         { message: dropped, kind: "reset" },
         { message: dropped, kind: "account-deleted" },
      ]);
   });

   it("prints the whole message when bodies are on so the link can be followed", async () => {
      const { email, infos, warnings } = await load(true);
      await sendOneOfEach(email);
      expect(warnings()).toEqual([]);
      const [invite, reset] = infos();
      expect(invite).toMatchObject({
         to: "invitee@corp.example",
         subject: "You've been invited to a server on S3 Viewer",
      });
      expect(invite?.text).toContain(
         "Invited by Mallory Inviter (mallory@corp.example)"
      );
      expect(invite?.text).toContain("invite=secret-token");
      expect(reset?.to).toBe("member@corp.example");
      expect(reset?.text).toContain("secret-reset");
   });

   it("logs through the logger it was handed instead of the console", async () => {
      vi.resetModules();
      const printed = vi.spyOn(console, "warn");
      const warn = vi.fn();
      const email = await import("./index");
      email.configureEmail({
         transport: "none",
         logBodies: false,
         logger: { info: vi.fn(), warn, error: vi.fn() },
      });
      await sendOneOfEach(email);
      expect(warn).toHaveBeenCalledWith("Email dropped (transport none)", {
         kind: "invite",
      });
      expect(printed).not.toHaveBeenCalled();
   });
});
