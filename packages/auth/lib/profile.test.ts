import { describe, expect, it } from "vitest";
import {
   DATA_IMAGE_MAX_BYTES,
   NAME_MAX,
   URL_IMAGE_MAX_BYTES,
   validateProfile,
} from "./profile";

const png = (payload = "iVBORw0KGgo=") => `data:image/png;base64,${payload}`;

describe("validateProfile", () => {
   it("passes when neither field is present", () => {
      expect(validateProfile({})).toEqual({ ok: true, data: {} });
   });

   it("trims the name and keeps it within 1–80 characters", () => {
      expect(validateProfile({ name: "  Ada  " })).toEqual({
         ok: true,
         data: { name: "Ada" },
      });
      expect(validateProfile({ name: "   " }).ok).toBe(false);
      expect(validateProfile({ name: "a".repeat(NAME_MAX) }).ok).toBe(true);
      expect(validateProfile({ name: "a".repeat(NAME_MAX + 1) }).ok).toBe(
         false
      );
   });

   it("accepts png, webp and jpeg data URLs and clears with null", () => {
      for (const type of ["png", "webp", "jpeg"]) {
         const image = `data:image/${type};base64,AAAA`;
         expect(validateProfile({ image })).toEqual({
            ok: true,
            data: { image },
         });
      }
      expect(validateProfile({ image: null })).toEqual({
         ok: true,
         data: { image: null },
      });
   });

   it("rejects other data URLs and non-URL strings", () => {
      expect(
         validateProfile({ image: "data:image/svg+xml;base64,AAAA" }).ok
      ).toBe(false);
      expect(
         validateProfile({ image: "data:image/png;base64,not base64!" }).ok
      ).toBe(false);
      expect(validateProfile({ image: "javascript:alert(1)" }).ok).toBe(false);
      expect(validateProfile({ image: "" }).ok).toBe(false);
   });

   it("caps inline images at 200 KB", () => {
      const room = DATA_IMAGE_MAX_BYTES - "data:image/png;base64,".length;
      expect(validateProfile({ image: png("A".repeat(room)) }).ok).toBe(true);
      expect(validateProfile({ image: png("A".repeat(room + 1)) }).ok).toBe(
         false
      );
   });

   it("accepts short http(s) URLs for provider avatars", () => {
      const url = "https://avatars.githubusercontent.com/u/1?v=4";
      expect(validateProfile({ image: url })).toEqual({
         ok: true,
         data: { image: url },
      });
      const long = `https://example.com/${"a".repeat(URL_IMAGE_MAX_BYTES)}`;
      expect(validateProfile({ image: long }).ok).toBe(false);
      expect(validateProfile({ image: "ftp://example.com/a.png" }).ok).toBe(
         false
      );
   });
});
