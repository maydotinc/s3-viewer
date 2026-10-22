import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = [
   "EMAIL_TRANSPORT",
   "RESEND_KEY",
   "SMTP_URL",
   "GITHUB_CLIENT_ID",
   "GITHUB_CLIENT_SECRET",
   "ALLOW_PRIVATE_ENDPOINTS",
   "AUDIT_CHAIN_KEY",
   "ACCEPT_NEW_AUDIT_CHAIN_KEY",
   "UPLOAD_PART_BYTES",
   "MAX_UPLOAD_BYTES",
   "MAX_CONCURRENT_UPLOADS",
   "MAX_USER_UPLOADS",
   "MAX_IP_UPLOADS",
   "UPLOAD_SLOT_MAX_MS",
   "UPLOAD_MEMORY_BUDGET_BYTES",
   "UPLOAD_IDLE_TIMEOUT_MS",
   "RATE_LIMIT_STORE",
   "TRUST_PROXY",
   "COOKIE_SAMESITE",
   "SIGNUP_MODE",
   "ALLOWED_EMAIL_DOMAINS",
   "EMAIL_FROM",
   "UNVERIFIED_ACCOUNT_TTL_DAYS",
   "PORT",
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

describe("shared auth settings", () => {
   it("reports cookie and sign-up problems in the one environment report", async () => {
      await expect(
         loadEnv({ COOKIE_SAMESITE: "strict", SIGNUP_MODE: "invite-only" })
      ).rejects.toThrow(
         /^Invalid environment: COOKIE_SAMESITE: must be `lax` or `none`; SIGNUP_MODE: must be one of/
      );
   });
});

describe("EMAIL_FROM", () => {
   it("is required in production only when a transport is configured", async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
         await expect(loadEnv()).resolves.toMatchObject({
            EMAIL_FROM: undefined,
         });
         await expect(loadEnv({ RESEND_KEY: "re_123" })).rejects.toThrow(
            /EMAIL_FROM: required in production/
         );
         await expect(
            loadEnv({
               RESEND_KEY: "re_123",
               EMAIL_FROM: "S3 Viewer <no-reply@example.com>",
            })
         ).resolves.toMatchObject({ EMAIL_TRANSPORT: "resend" });
      } finally {
         process.env.NODE_ENV = previousNodeEnv;
      }
   });
});

describe("boolean flags", () => {
   // every boolean flag shares one transform, so one flag stands for them all.
   it("reads the usual spellings of on and off, in any case", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      for (const value of ["true", "TRUE", "1", "yes", "on"]) {
         await expect(
            loadEnv({ ALLOW_PRIVATE_ENDPOINTS: value })
         ).resolves.toMatchObject({ ALLOW_PRIVATE_ENDPOINTS: true });
      }
      for (const value of ["", "false", "False", "0", "no", "off"]) {
         await expect(
            loadEnv({ ALLOW_PRIVATE_ENDPOINTS: value })
         ).resolves.toMatchObject({ ALLOW_PRIVATE_ENDPOINTS: false });
      }
   });

   it("refuses a value it cannot read instead of treating it as off", async () => {
      await expect(
         loadEnv({ ACCEPT_NEW_AUDIT_CHAIN_KEY: "maybe" })
      ).rejects.toThrow(/ACCEPT_NEW_AUDIT_CHAIN_KEY.*expected true or false/);
   });

   it("warns once when private endpoints are allowed", async () => {
      const warn = vi.spyOn(console, "error").mockImplementation(() => {});
      await loadEnv({ ALLOW_PRIVATE_ENDPOINTS: "true" });
      expect(
         warn.mock.calls.filter(([line]) =>
            String(line).includes("ALLOW_PRIVATE_ENDPOINTS=true")
         )
      ).toHaveLength(1);
   });
});

describe("AUDIT_CHAIN_KEY", () => {
   it("accepts a value at least 32 characters long", async () => {
      const key = Buffer.alloc(32, 1).toString("base64");
      await expect(loadEnv({ AUDIT_CHAIN_KEY: key })).resolves.toMatchObject({
         AUDIT_CHAIN_KEY: key,
      });
   });

   it("rejects a 32-character value that is not base64", async () => {
      await expect(
         loadEnv({ AUDIT_CHAIN_KEY: "!".repeat(32) })
      ).rejects.toThrow(/AUDIT_CHAIN_KEY: must be base64/);
   });

   it("rejects base64 that decodes to fewer than 32 bytes", async () => {
      const key = Buffer.alloc(16, 1).toString("base64");
      await expect(loadEnv({ AUDIT_CHAIN_KEY: key })).rejects.toThrow(
         /AUDIT_CHAIN_KEY: must decode to at least 32 bytes/
      );
   });
});

describe("TRUST_PROXY", () => {
   it("defaults to loopback and passes named lists through", async () => {
      await expect(loadEnv()).resolves.toMatchObject({
         TRUST_PROXY: "loopback",
      });
      await expect(
         loadEnv({ TRUST_PROXY: "loopback, 10.0.0.0/8" })
      ).resolves.toMatchObject({ TRUST_PROXY: "loopback, 10.0.0.0/8" });
   });

   it("reads a hop count as a number and true/false as booleans", async () => {
      await expect(loadEnv({ TRUST_PROXY: "1" })).resolves.toMatchObject({
         TRUST_PROXY: 1,
      });
      await expect(loadEnv({ TRUST_PROXY: "true" })).resolves.toMatchObject({
         TRUST_PROXY: true,
      });
      await expect(loadEnv({ TRUST_PROXY: "false" })).resolves.toMatchObject({
         TRUST_PROXY: false,
      });
   });
});

describe("TRUST_PROXY outside local development", () => {
   it.each(["production", undefined])(
      "refuses true with NODE_ENV %s and accepts a hop count or CIDR list",
      async (nodeEnv) => {
         const previousNodeEnv = process.env.NODE_ENV;
         if (nodeEnv === undefined) delete process.env.NODE_ENV;
         else process.env.NODE_ENV = nodeEnv;
         try {
            await expect(loadEnv({ TRUST_PROXY: "true" })).rejects.toThrow(
               /TRUST_PROXY: `true` trusts any client-supplied X-Forwarded-For/
            );
            await expect(loadEnv({ TRUST_PROXY: "1" })).resolves.toMatchObject({
               TRUST_PROXY: 1,
            });
            await expect(
               loadEnv({ TRUST_PROXY: "loopback, 10.0.0.0/8" })
            ).resolves.toMatchObject({ TRUST_PROXY: "loopback, 10.0.0.0/8" });
         } finally {
            process.env.NODE_ENV = previousNodeEnv;
         }
      }
   );
});

describe("RATE_LIMIT_STORE", () => {
   it("warns once when memory is used in production", async () => {
      const warn = vi.spyOn(console, "error").mockImplementation(() => {});
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
         await expect(
            loadEnv({ RATE_LIMIT_STORE: "memory" })
         ).resolves.toMatchObject({ RATE_LIMIT_STORE: "memory" });
      } finally {
         process.env.NODE_ENV = previousNodeEnv;
      }
      expect(
         warn.mock.calls.filter(([line]) =>
            String(line).includes("RATE_LIMIT_STORE=memory")
         )
      ).toHaveLength(1);
   });

   it("does not warn in production when the store is postgres", async () => {
      const warn = vi.spyOn(console, "error").mockImplementation(() => {});
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
         await loadEnv();
      } finally {
         process.env.NODE_ENV = previousNodeEnv;
      }
      expect(
         warn.mock.calls.some(([line]) =>
            String(line).includes("RATE_LIMIT_STORE")
         )
      ).toBe(false);
   });

   it("does not warn outside production even on memory", async () => {
      const warn = vi.spyOn(console, "error").mockImplementation(() => {});
      await loadEnv({ RATE_LIMIT_STORE: "memory" });
      expect(
         warn.mock.calls.some(([line]) =>
            String(line).includes("RATE_LIMIT_STORE")
         )
      ).toBe(false);
   });
});

describe("upload resource limits", () => {
   it("requires positive integer limits", async () => {
      for (const key of [
         "MAX_CONCURRENT_UPLOADS",
         "MAX_USER_UPLOADS",
         "MAX_IP_UPLOADS",
         "UPLOAD_SLOT_MAX_MS",
         "UPLOAD_MEMORY_BUDGET_BYTES",
         "UPLOAD_IDLE_TIMEOUT_MS",
      ]) {
         for (const value of ["0", "1.5"]) {
            await expect(loadEnv({ [key]: value })).rejects.toThrow(key);
         }
      }
   });
   it("refuses a part size that cannot fit the memory budget", async () => {
      await expect(
         loadEnv({ UPLOAD_PART_BYTES: String(100 * 1024 * 1024) })
      ).rejects.toThrow(/UPLOAD_MEMORY_BUDGET_BYTES/);
      await expect(
         loadEnv({
            UPLOAD_PART_BYTES: String(100 * 1024 * 1024),
            UPLOAD_MEMORY_BUDGET_BYTES: String(400 * 1024 * 1024),
         })
      ).rejects.toThrow(/UPLOAD_MEMORY_BUDGET_BYTES/);
      await expect(
         loadEnv({
            UPLOAD_PART_BYTES: String(100 * 1024 * 1024),
            UPLOAD_MEMORY_BUDGET_BYTES: String(400 * 1024 * 1024 + 1),
         })
      ).resolves.toMatchObject({ UPLOAD_PART_BYTES: 100 * 1024 * 1024 });
   });

   it("sizes the memory budget check to the largest part MAX_UPLOAD_BYTES needs", async () => {
      const fiveTiB = String(5 * 1024 ** 4);
      await expect(loadEnv({ MAX_UPLOAD_BYTES: fiveTiB })).rejects.toThrow(
         /UPLOAD_MEMORY_BUDGET_BYTES: must hold more than 4 buffers of 67108864 bytes/
      );
      await expect(
         loadEnv({
            MAX_UPLOAD_BYTES: fiveTiB,
            UPLOAD_MEMORY_BUDGET_BYTES: String(256 * 1024 * 1024 + 1),
         })
      ).resolves.toMatchObject({ MAX_UPLOAD_BYTES: 5 * 1024 ** 4 });
   });
});

describe("PORT", () => {
   it("falls back to 5001 when left blank", async () => {
      await expect(loadEnv()).resolves.toMatchObject({ PORT: 5001 });
      await expect(loadEnv({ PORT: "8080" })).resolves.toMatchObject({
         PORT: 8080,
      });
   });
});

describe("UNVERIFIED_ACCOUNT_TTL_DAYS", () => {
   it("defaults to a week and accepts 0 to keep unverified accounts", async () => {
      await expect(loadEnv()).resolves.toMatchObject({
         UNVERIFIED_ACCOUNT_TTL_DAYS: 7,
      });
      await expect(
         loadEnv({ UNVERIFIED_ACCOUNT_TTL_DAYS: "0" })
      ).resolves.toMatchObject({ UNVERIFIED_ACCOUNT_TTL_DAYS: 0 });
   });

   it("requires a whole number of days", async () => {
      for (const value of ["-1", "1.5", "soon"]) {
         await expect(
            loadEnv({ UNVERIFIED_ACCOUNT_TTL_DAYS: value })
         ).rejects.toThrow("UNVERIFIED_ACCOUNT_TTL_DAYS");
      }
   });
});
