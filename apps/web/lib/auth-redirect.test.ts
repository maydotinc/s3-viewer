import { describe, expect, it } from "vitest";
import { afterLoginPath, isSafeNextPath, loginPathFor } from "./auth-redirect";

describe("isSafeNextPath", () => {
   it("accepts relative paths", () => {
      expect(isSafeNextPath("/")).toBe(true);
      expect(isSafeNextPath("/dashboard")).toBe(true);
      expect(isSafeNextPath("/buckets/a?prefix=x/y")).toBe(true);
   });

   it("rejects anything that could leave the origin", () => {
      expect(isSafeNextPath("//evil.example")).toBe(false);
      expect(isSafeNextPath("/\\evil.example")).toBe(false);
      expect(isSafeNextPath("https://evil.example")).toBe(false);
      expect(isSafeNextPath("dashboard")).toBe(false);
      expect(isSafeNextPath("/a\nb")).toBe(false);
      expect(isSafeNextPath(["/dashboard"])).toBe(false);
      expect(isSafeNextPath(undefined)).toBe(false);
   });
});

describe("afterLoginPath", () => {
   it("follows a safe next and falls back to the dashboard", () => {
      expect(afterLoginPath("/invites")).toBe("/invites");
      expect(afterLoginPath("//evil.example")).toBe("/dashboard");
      expect(afterLoginPath(undefined)).toBe("/dashboard");
   });
});

describe("loginPathFor", () => {
   it("carries the current location as next", () => {
      expect(loginPathFor("/dashboard")).toBe("/login?next=%2Fdashboard");
      expect(loginPathFor("/buckets/a?prefix=b")).toBe(
         "/login?next=%2Fbuckets%2Fa%3Fprefix%3Db"
      );
   });

   it("omits next for the root", () => {
      expect(loginPathFor("/")).toBe("/login");
   });

   it("keeps a callback error inside next", () => {
      expect(loginPathFor("/dashboard?error=other")).toBe(
         "/login?next=%2Fdashboard%3Ferror%3Dother"
      );
   });
});
