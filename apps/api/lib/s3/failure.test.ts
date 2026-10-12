import { describe, expect, it } from "vitest";
import { uploadConflict } from "./conditions";
import { deleteFailureMessage } from "./classify";
import { deleteRequestFailure } from "./checked-delete";
import { isConflict, isForbidden } from "./failure";

describe("conditional write failure recognition", () => {
   it.each([
      { name: "PreconditionFailed" },
      { name: "ConditionalRequestConflict" },
      { code: "PreconditionFailed", name: "Error" },
      { code: "ConditionalRequestConflict" },
      { $metadata: { httpStatusCode: 412 } },
   ])("recognizes a conflict consistently: %j", (failure) => {
      expect(isConflict(failure)).toBe(true);
      expect(uploadConflict(failure)).toBe(true);
      expect(deleteRequestFailure(failure, "key", true, undefined)).toEqual({
         key: "key",
         retryable: false,
         message: deleteFailureMessage("PreconditionFailed"),
      });
   });

   it("keeps a bare HTTP 409 specific to uploads", () => {
      const failure = { $metadata: { httpStatusCode: 409 } };
      expect(isConflict(failure)).toBe(false);
      expect(uploadConflict(failure)).toBe(true);
   });

   it.each([
      undefined,
      null,
      412,
      "PreconditionFailed",
      {},
      { name: "Unknown" },
      { $metadata: { httpStatusCode: "412" } },
   ])("does not infer a conflict from %j", (failure) => {
      expect(isConflict(failure)).toBe(false);
      expect(uploadConflict(failure)).toBe(false);
   });
});

describe("forbidden recognition", () => {
   it.each([
      { name: "AccessDenied" },
      { name: "Forbidden" },
      { code: "AccessDenied", name: "Error" },
   ])("treats %j as forbidden", (failure) => {
      expect(isForbidden(failure)).toBe(true);
   });

   it.each([
      undefined,
      {},
      { name: "NoSuchKey" },
      { name: "InvalidAccessKeyId", $metadata: { httpStatusCode: 403 } },
   ])("does not infer forbidden from %j", (failure) => {
      expect(isForbidden(failure)).toBe(false);
   });
});
