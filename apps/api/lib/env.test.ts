import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = [
   "EMAIL_TRANSPORT",
   "RESEND_KEY",
   "SMTP_URL",
   "GITHUB_CLIENT_ID",
   "GITHUB_CLIENT_SECRET",
   "ALLOW_PRIVATE_ENDPOINTS",
] as const;

const loadEnv = async (overrides: Partial<Record<string, string>> = {}) => {
   for (const key of KEYS) process.env[key] = overrides[key] ?? "";
   vi.resetModules();
   return (await import("./env")).env;
};

afterEach(async () => {
   for (const key of KEYS) process.env[key] = "";
   vi.restoreAllMocks();
   vi.resetModules();
});

describe("EMAIL_TRANSPORT", () => {
   it("is none when neither credential is set", async () => {
      await expect(loadEnv()).resolves.toMatchObject({
         EMAIL_TRANSPORT: "none",
      });
   });

   it("is inferred from whichever credential is set", async () => {
      await expect(loadEnv({ RESEND_KEY: "re_123" })).resolves.toMatchObject({
         EMAIL_TRANSPORT: "resend",
      });
      await expect(
         loadEnv({ SMTP_URL: "smtp://user:pass@mail.example.com:587" })
      ).resolves.toMatchObject({ EMAIL_TRANSPORT: "smtp" });
      await expect(
         loadEnv({
            RESEND_KEY: "re_123",
            SMTP_URL: "smtp://user:pass@mail.example.com:587",
         })
      ).resolves.toMatchObject({ EMAIL_TRANSPORT: "resend" });
   });

   it("honours an explicit none even with a key configured", async () => {
      await expect(
         loadEnv({ EMAIL_TRANSPORT: "none", RESEND_KEY: "re_123" })
      ).resolves.toMatchObject({ EMAIL_TRANSPORT: "none" });
   });

   it("fails to boot when an explicit transport has nothing to connect with", async () => {
      await expect(loadEnv({ EMAIL_TRANSPORT: "smtp" })).rejects.toThrow(
         /SMTP_URL: required when EMAIL_TRANSPORT is `smtp`/
      );
      await expect(loadEnv({ EMAIL_TRANSPORT: "resend" })).rejects.toThrow(
         /RESEND_KEY: required when EMAIL_TRANSPORT is `resend`/
      );
   });

   it("rejects an unknown transport name and a non-smtp SMTP_URL", async () => {
      await expect(loadEnv({ EMAIL_TRANSPORT: "sendgrid" })).rejects.toThrow(
         /EMAIL_TRANSPORT/
      );
      await expect(
         loadEnv({ SMTP_URL: "https://mail.example.com" })
      ).rejects.toThrow(/smtp:\/\/ or smtps:\/\//);
   });
});

describe("ALLOW_PRIVATE_ENDPOINTS", () => {
   it("is true only for the exact string `true`, and warns once when it is", async () => {
      const warn = vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(
         loadEnv({ ALLOW_PRIVATE_ENDPOINTS: "true" })
      ).resolves.toMatchObject({ ALLOW_PRIVATE_ENDPOINTS: true });
      expect(
         warn.mock.calls.filter(([line]) =>
            String(line).includes("ALLOW_PRIVATE_ENDPOINTS=true")
         )
      ).toHaveLength(1);
   });

   it("is false for anything else", async () => {
      for (const value of ["", "TRUE", "1", "yes", "false"]) {
         await expect(
            loadEnv({ ALLOW_PRIVATE_ENDPOINTS: value })
         ).resolves.toMatchObject({ ALLOW_PRIVATE_ENDPOINTS: false });
      }
   });
});

describe("GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET", () => {
   it("must be set together", async () => {
      await expect(loadEnv({ GITHUB_CLIENT_ID: "id" })).rejects.toThrow(
         /must be set together/
      );
      await expect(loadEnv({ GITHUB_CLIENT_SECRET: "secret" })).rejects.toThrow(
         /must be set together/
      );
      await expect(
         loadEnv({ GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" })
      ).resolves.toMatchObject({ GITHUB_CLIENT_ID: "id" });
   });
});
