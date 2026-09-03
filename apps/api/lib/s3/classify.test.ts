import { describe, expect, it } from "vitest";
import { classifyS3Error, deleteFailureMessage } from "./classify";

const s3Error = (name: string, httpStatusCode?: number, message = "") => ({
   name,
   message,
   $metadata: { httpStatusCode },
});

describe("classifyS3Error", () => {
   it("maps missing objects and buckets to 404", () => {
      expect(classifyS3Error(s3Error("NoSuchKey", 404))).toMatchObject({
         status: 404,
         message: "Object not found",
      });
      expect(classifyS3Error(s3Error("NotFound", 404))).toMatchObject({
         status: 404,
      });
      expect(classifyS3Error(s3Error("UnknownError", 404))).toMatchObject({
         status: 404,
      });
      expect(classifyS3Error(s3Error("NoSuchBucket", 404))).toMatchObject({
         status: 404,
         message: "Bucket not found",
      });
   });

   it("maps access problems to 403", () => {
      expect(classifyS3Error(s3Error("AccessDenied", 403))).toMatchObject({
         status: 403,
         message: "The server credentials don't allow this",
      });
      expect(classifyS3Error(s3Error("Whatever", 403))).toMatchObject({
         status: 403,
      });
   });

   it("maps size limits to 413 before the generic 400", () => {
      expect(classifyS3Error(s3Error("EntityTooLarge", 400))).toMatchObject({
         status: 413,
      });
      expect(
         classifyS3Error(
            s3Error(
               "InvalidRequest",
               400,
               "The specified copy source is larger than the maximum allowable size"
            )
         )
      ).toMatchObject({ status: 413 });
      expect(
         classifyS3Error(s3Error("InvalidRequest", 400, "other"))
      ).toMatchObject({
         status: 400,
      });
   });

   it("maps client mistakes to 400", () => {
      expect(classifyS3Error(s3Error("InvalidBucketName", 400))).toMatchObject({
         status: 400,
      });
      expect(classifyS3Error(s3Error("InvalidArgument", 400))).toMatchObject({
         status: 400,
      });
   });

   it("maps network failures to 502 unreachable", () => {
      const unreachable = {
         status: 502,
         message: "Couldn't reach the storage endpoint",
      };
      expect(
         classifyS3Error({ name: "TimeoutError", message: "" })
      ).toMatchObject(unreachable);
      expect(
         classifyS3Error({ name: "Error", code: "ENOTFOUND" })
      ).toMatchObject(unreachable);
      expect(
         classifyS3Error({ name: "Error", code: "ECONNREFUSED" })
      ).toMatchObject(unreachable);
   });

   it("falls back to 502 without leaking the original message", () => {
      const mapped = classifyS3Error(new Error("secret internal detail"));
      expect(mapped).toMatchObject({
         status: 502,
         message: "Storage request failed",
      });
      expect(classifyS3Error("string error")).toMatchObject({ status: 502 });
      expect(classifyS3Error(undefined)).toMatchObject({
         status: 502,
         name: "Unknown",
      });
   });

   it("reports the error name for logging", () => {
      expect(classifyS3Error(s3Error("NoSuchKey", 404)).name).toBe("NoSuchKey");
      expect(classifyS3Error({ code: "ECONNRESET" }).name).toBe("ECONNRESET");
   });
});

describe("deleteFailureMessage", () => {
   it("uses safe per-key messages", () => {
      expect(deleteFailureMessage("AccessDenied")).toBe(
         "The server credentials don't allow this"
      );
      expect(deleteFailureMessage("InternalError")).toBe(
         "Storage request failed"
      );
      expect(deleteFailureMessage(undefined)).toBe("Storage request failed");
   });
});
