import { describe, expect, it } from "vitest";
import { Role } from "../server-types";
import { grantableRoleSchema } from "./primitives";
import { auditQuerySchema, auditSettingsSchema } from "./server";

describe("audit date filters", () => {
   it.each(["from", "to"])(
      "bounds %s to supported timestamp years",
      (field) => {
         for (const date of [
            "0000-01-01T00:00:00.000Z",
            "-000001-01-01T00:00:00.000Z",
            "+010000-01-01T00:00:00.000Z",
            "not-a-date",
         ]) {
            expect(
               auditQuerySchema.safeParse({
                  serverId: "server01",
                  [field]: date,
               }).success
            ).toBe(false);
         }
         for (const date of [
            "0001-01-01T00:00:00.000Z",
            "9999-12-31T23:59:59.999Z",
         ]) {
            const result = auditQuerySchema.parse({
               serverId: "server01",
               [field]: date,
            });
            expect(result[field as "from" | "to"]?.toISOString()).toBe(date);
         }
      }
   );
});

describe("audit text search", () => {
   const accepts = (q: string): boolean =>
      auditQuerySchema.safeParse({ serverId: "server01", q }).success;

   it("needs at least three characters, enough for a trigram index", () => {
      expect(accepts("")).toBe(false);
      expect(accepts("a")).toBe(false);
      expect(accepts("ab")).toBe(false);
      expect(accepts("abc")).toBe(true);
   });

   it("caps the search at 256 characters", () => {
      expect(accepts("x".repeat(256))).toBe(true);
      expect(accepts("x".repeat(257))).toBe(false);
   });
});

describe("audit bucket filter", () => {
   it("accepts every bucket name the app can open, up to 255 characters", () => {
      const accepts = (bucket: string): boolean =>
         auditQuerySchema.safeParse({ serverId: "server01", bucket }).success;
      expect(accepts("b".repeat(255))).toBe(true);
      expect(accepts("b".repeat(256))).toBe(false);
   });
});

describe("role validation boundaries", () => {
   it.each(Object.values(Role))("preserves the role subsets for %s", (role) => {
      expect(grantableRoleSchema.safeParse(role).success).toBe(
         role !== Role.OWNER
      );
      const settings = { serverId: "server01", enabled: true };
      expect(
         auditSettingsSchema.safeParse({ ...settings, viewRole: role }).success
      ).toBe(true);
      expect(
         auditSettingsSchema.safeParse({ ...settings, manageRole: role })
            .success
      ).toBe(role === Role.OWNER || role === Role.ADMIN);
   });
});
