import { describe, expect, it } from "vitest";
import { NAME_MAX, validateProfile } from "./profile";

describe("validateProfile", () => {
   it("passes when no field is present", () => {
      expect(validateProfile({})).toEqual({
         ok: true,
         data: { image: undefined },
      });
   });

   it("trims the name and keeps it within 1–80 characters", () => {
      expect(validateProfile({ name: "  Ada  " })).toEqual({
         ok: true,
         data: { name: "Ada", image: undefined },
      });
      expect(validateProfile({ name: "   " }).ok).toBe(false);
      expect(validateProfile({ name: "a".repeat(NAME_MAX) }).ok).toBe(true);
      expect(validateProfile({ name: "a".repeat(NAME_MAX + 1) }).ok).toBe(
         false
      );
   });

   it("strips any image to undefined instead of failing", () => {
      for (const image of [
         "data:image/png;base64,AAAA",
         "https://avatars.githubusercontent.com/u/1?v=4",
         "javascript:alert(1)",
         "",
         null,
      ]) {
         const result = validateProfile({ name: "Ada", image });
         expect(result).toEqual({
            ok: true,
            data: { name: "Ada", image: undefined },
         });
      }
   });

   it("carries `image` as an own key, so spreading it clears an incoming one", () => {
      const result = validateProfile({ image: "https://example.com/a.png" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(Object.hasOwn(result.data, "image")).toBe(true);
      expect({ image: "https://example.com/a.png", ...result.data }).toEqual({
         image: undefined,
      });
   });
});
