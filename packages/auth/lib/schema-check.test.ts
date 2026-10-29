import { describe, expect, it, vi } from "vitest";

vi.mock("@s3-viewer/email", () => ({
   sendPasswordResetEmail: vi.fn(),
   sendVerificationCodeEmail: vi.fn(),
}));
vi.mock("./env", () => ({
   authEnv: {
      secret: "regression-test-secret-at-least-thirty-two-chars",
      apiOrigin: "http://localhost:5001",
      apiIsHttps: false,
      cookieSameSite: "lax",
      siteOrigin: "http://localhost:3000",
      github: undefined,
   },
   signUpPolicy: { mode: "open", allowedEmailDomains: [] },
}));

import { auth } from "./auth";

describe("generated Prisma client", () => {
   // better-auth 1.7.3+ diffs its core tables against the generated client at startup and fails
   // every request on a mismatch; the memory-adapter suite never reaches that check. a request
   // without a cookie resolves before any query, so no database is needed.
   it("passes better-auth's schema check", async () => {
      await expect(
         auth.api.getSession({ headers: new Headers() })
      ).resolves.toBeNull();
   });
});
