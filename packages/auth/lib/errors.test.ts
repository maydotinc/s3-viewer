import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
   it("gives a known code its own words", () => {
      expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe(
         "Wrong email or password."
      );
   });

   it("treats a 429 without a code as too many attempts", () => {
      expect(authErrorMessage({ status: 429 })).toMatch(/too many attempts/i);
   });

   it("never shows an unknown message from the server", () => {
      expect(
         authErrorMessage({ code: "SOMETHING_INTERNAL", message: "stack" })
      ).toBe(GENERIC_ERROR_MESSAGE);
      expect(authErrorMessage({ code: "toString" })).toBe(
         GENERIC_ERROR_MESSAGE
      );
   });
});
