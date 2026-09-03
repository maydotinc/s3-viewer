import { describe, expect, it } from "vitest";
import { avatarGradient, avatarHues, avatarInitials, hashName } from "./avatar";

const NAMES = [
   "Ada Lovelace",
   "ada lovelace",
   "Grace Hopper",
   "Katherine Johnson",
   "Radia Perlman",
   "b",
   "",
   "  Margaret   Hamilton  ",
   "Jean-Bart de la Tour d'Auvergne",
   "日本語 の 名前",
];

describe("hashName", () => {
   it("is deterministic and ignores surrounding whitespace", () => {
      expect(hashName("Ada Lovelace")).toBe(hashName("  Ada Lovelace  "));
      expect(hashName("Ada Lovelace")).toBe(hashName("Ada Lovelace"));
   });

   it("returns an unsigned 32-bit integer", () => {
      for (const name of NAMES) {
         const hash = hashName(name);
         expect(Number.isInteger(hash)).toBe(true);
         expect(hash).toBeGreaterThanOrEqual(0);
         expect(hash).toBeLessThan(2 ** 32);
      }
   });

   it("separates names that differ", () => {
      expect(hashName("Ada Lovelace")).not.toBe(hashName("ada lovelace"));
      expect(hashName("Ada Lovelace")).not.toBe(hashName("Ada Lovelacf"));
   });
});

describe("avatarInitials", () => {
   it("takes the first letter of the first two words, uppercased", () => {
      expect(avatarInitials("Ada Lovelace")).toBe("AL");
      expect(avatarInitials("ada lovelace")).toBe("AL");
      expect(avatarInitials("  Margaret   Hamilton  ")).toBe("MH");
   });

   it("uses the first two words, not the first and last", () => {
      expect(avatarInitials("Katherine Grace Johnson")).toBe("KG");
   });

   it("gives one letter for a single word", () => {
      expect(avatarInitials("Ada")).toBe("A");
      expect(avatarInitials("  ada  ")).toBe("A");
   });

   it('falls back to "?" for an empty or whitespace-only name', () => {
      expect(avatarInitials("")).toBe("?");
      expect(avatarInitials("   ")).toBe("?");
   });
});

describe("avatarHues", () => {
   it("is deterministic for the same trimmed name", () => {
      expect(avatarHues("Grace Hopper")).toEqual(avatarHues(" Grace Hopper "));
   });

   it("keeps both hues in [0, 360)", () => {
      for (const name of NAMES) {
         const { from, to } = avatarHues(name);
         for (const hue of [from, to]) {
            expect(Number.isInteger(hue)).toBe(true);
            expect(hue).toBeGreaterThanOrEqual(0);
            expect(hue).toBeLessThan(360);
         }
      }
   });

   it("never puts the two stops on the same hue", () => {
      for (const name of NAMES) {
         const { from, to } = avatarHues(name);
         expect(to).not.toBe(from);
      }
   });

   it("spreads different names across the wheel", () => {
      const hues = new Set(NAMES.map((name) => avatarHues(name).from));
      expect(hues.size).toBeGreaterThan(NAMES.length / 2);
   });
});

describe("avatarGradient", () => {
   it("renders a 135° two-stop gradient from the name's hues", () => {
      const { from, to } = avatarHues("Ada Lovelace");
      expect(avatarGradient("Ada Lovelace")).toBe(
         `linear-gradient(135deg, hsl(${from} 72% 58%), hsl(${to} 68% 42%))`
      );
   });

   it("is deterministic", () => {
      expect(avatarGradient("Radia Perlman")).toBe(
         avatarGradient("Radia Perlman")
      );
      expect(avatarGradient("Radia Perlman")).not.toBe(
         avatarGradient("Grace Hopper")
      );
   });
});
