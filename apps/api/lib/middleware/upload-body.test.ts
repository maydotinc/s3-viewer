import { describe, expect, it } from "vitest";
import { isObjectUpload } from "./upload-body";

const OBJECTS = "/servers/server123/buckets/backups/objects";

describe("isObjectUpload", () => {
   it("keeps json parsing off an object upload and on every other mutation", () => {
      expect(
         isObjectUpload({
            method: "PUT",
            baseUrl: OBJECTS,
            path: "/v3/upload/",
         })
      ).toBe(true);
      expect(
         isObjectUpload({
            method: "POST",
            baseUrl: OBJECTS,
            path: "/v3/rename",
         })
      ).toBe(false);
   });
});
