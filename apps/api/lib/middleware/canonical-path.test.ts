import { describe, expect, it } from "vitest";
import { isCanonical } from "./canonical-path";

describe("isCanonical", () => {
   it.each([
      "/",
      "/auth/sign-up/email",
      "/servers/abc123/buckets/my.bucket",
      "/invites/tok_en-123",
      "/servers/a%20b",
   ])("accepts %s", (path) => {
      expect(isCanonical(path)).toBe(true);
   });

   it.each([
      "/auth/./sign-up/email",
      "/auth/../auth/sign-up/email",
      "/auth/x/../sign-up/email",
      "/auth/%2e/sign-up/email",
      "/auth/%2E%2E/auth/sign-up/email",
      "/auth/sign-up/email/.",
      "/auth/sign-up%2femail",
      "/auth/sign-up%5Cemail",
      "/auth\\sign-up/email",
      "//auth/sign-up/email",
      "/auth//sign-up/email",
      "http://evil.example/auth/sign-up/email",
      "*",
      "",
   ])("rejects %s", (path) => {
      expect(isCanonical(path)).toBe(false);
   });
});
