import { describe, expect, it } from "vitest";
import { origin } from "./origin";

describe("origin", () => {
   it("returns the origin of a full URL", () => {
      expect(origin("https://api.s3-viewer.com/v1?x=1")).toBe(
         "https://api.s3-viewer.com"
      );
   });

   it("prepends https when the scheme is missing", () => {
      expect(origin("api.s3-viewer.com")).toBe("https://api.s3-viewer.com");
      expect(origin("localhost:3001")).toBe("https://localhost:3001");
   });

   it("keeps an explicit http scheme", () => {
      expect(origin("http://localhost:3001/")).toBe("http://localhost:3001");
   });

   it("trims whitespace", () => {
      expect(origin("  https://web.localhost  ")).toBe("https://web.localhost");
   });

   it("returns an empty string for unusable values", () => {
      expect(origin(undefined)).toBe("");
      expect(origin("")).toBe("");
      expect(origin("   ")).toBe("");
      expect(origin("https://")).toBe("");
      expect(origin("ftp://files.example.com")).toBe("");
   });
});
