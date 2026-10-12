import { describe, expect, it } from "vitest";
import {
   afterLoginPath,
   inviteIdFrom,
   isSafeNextPath,
   loginPathFor,
} from "./auth-redirect";

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

   it("never sends a signed-in user back to an auth screen", () => {
      expect(afterLoginPath("/login")).toBe("/dashboard");
      expect(afterLoginPath("/login?next=%2Fdashboard")).toBe("/dashboard");
      expect(afterLoginPath("/signup")).toBe("/dashboard");
      expect(afterLoginPath("/forgot-password")).toBe("/dashboard");
      expect(afterLoginPath("/reset-password?token=abc")).toBe("/dashboard");
      expect(afterLoginPath("/login-history")).toBe("/login-history");
   });
});

describe("inviteIdFrom", () => {
   it("reads the invitation id only off the invites page path", () => {
      expect(inviteIdFrom("/settings/invites?invite=abc123xy")).toBe(
         "abc123xy"
      );
      expect(inviteIdFrom("/settings/invites")).toBeUndefined();
      expect(inviteIdFrom("/settings/invites?invite=")).toBeUndefined();
      expect(inviteIdFrom("/dashboard?invite=abc123xy")).toBeUndefined();
      expect(
         inviteIdFrom("//evil.example/settings/invites?invite=x")
      ).toBeUndefined();
      expect(inviteIdFrom(undefined)).toBeUndefined();
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

   it("adds a reason for the login page to show", () => {
      expect(loginPathFor("/dashboard", "expired")).toBe(
         "/login?next=%2Fdashboard&reason=expired"
      );
      expect(loginPathFor("/", "expired")).toBe("/login?reason=expired");
   });

   it("keeps a callback error inside next", () => {
      expect(loginPathFor("/dashboard?error=other")).toBe(
         "/login?next=%2Fdashboard%3Ferror%3Dother"
      );
   });
});
