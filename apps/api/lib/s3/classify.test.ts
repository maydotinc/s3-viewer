import { describe, expect, it } from "vitest";
import { ErrorCode } from "@s3-viewer/shared";
import { classifyS3Error } from "./classify";

const s3Error = (name: string, httpStatusCode?: number, message = "") => ({
   name,
   message,
   $metadata: { httpStatusCode },
});

describe("classifyS3Error", () => {
   it("maps missing objects and buckets to 404", () => {
      expect(classifyS3Error(s3Error("NoSuchKey", 404))).toMatchObject({
         kind: "notFound",
         message: "Object not found",
      });
      expect(classifyS3Error(s3Error("NotFound", 404))).toMatchObject({
         kind: "notFound",
      });
      expect(classifyS3Error(s3Error("UnknownError", 404))).toMatchObject({
         kind: "notFound",
      });
      expect(classifyS3Error(s3Error("NoSuchBucket", 404))).toMatchObject({
         kind: "notFound",
         message: "Bucket not found",
      });
   });

   it("tells a missing multipart upload apart from a missing object", () => {
      expect(classifyS3Error(s3Error("NoSuchUpload", 404))).toMatchObject({
         kind: "notFound",
         message: "This upload no longer exists. Start it again.",
      });
   });

   it("maps access problems to 403", () => {
      expect(classifyS3Error(s3Error("AccessDenied", 403))).toMatchObject({
         kind: "forbidden",
         message: "The server credentials don't allow this",
      });
      expect(classifyS3Error(s3Error("Whatever", 403))).toMatchObject({
         kind: "forbidden",
      });
   });

   it("flags rejected credentials as an upstream failure with a code", () => {
      for (const name of [
         "InvalidAccessKeyId",
         "SignatureDoesNotMatch",
         "InvalidClientTokenId",
         "InvalidToken",
      ]) {
         expect(classifyS3Error(s3Error(name, 403)), name).toMatchObject({
            kind: "upstream",
            message: "The server rejected these credentials",
            code: ErrorCode.CREDENTIALS_REJECTED,
         });
      }
      expect(classifyS3Error(s3Error("AccessDenied", 403)).code).toBe(
         undefined
      );
   });

   it.each(["ExpiredToken", "ExpiredTokenException", "TokenRefreshRequired"])(
      "asks for replacement temporary credentials on %s without leaking provider detail",
      (name) => {
         expect(
            classifyS3Error(s3Error(name, 403, "secret token detail"))
         ).toMatchObject({
            kind: "upstream",
            message:
               "The temporary credentials expired. Update the access key, secret key and session token.",
            code: ErrorCode.CREDENTIALS_REJECTED,
         });
      }
   );

   it("maps an archived object to 409 before the generic 403", () => {
      expect(classifyS3Error(s3Error("InvalidObjectState", 403))).toMatchObject(
         {
            kind: "conflict",
            message: "Object is archived and must be restored first",
         }
      );
   });

   it("maps a failed precondition to the same 409 as an existing target", () => {
      expect(classifyS3Error(s3Error("PreconditionFailed", 412))).toMatchObject(
         {
            kind: "conflict",
            message: "An object with that name already exists",
         }
      );
      expect(classifyS3Error(s3Error("Whatever", 412))).toMatchObject({
         kind: "upstream",
      });
   });

   it("maps size limits to 413 before the generic 400", () => {
      expect(classifyS3Error(s3Error("EntityTooLarge", 400))).toMatchObject({
         kind: "tooLarge",
      });
      expect(
         classifyS3Error(
            s3Error(
               "InvalidRequest",
               400,
               "The specified copy source is larger than the maximum allowable size"
            )
         )
      ).toMatchObject({ kind: "tooLarge" });
      expect(
         classifyS3Error(s3Error("InvalidRequest", 400, "other"))
      ).toMatchObject({
         kind: "invalid",
      });
   });

   it("maps client mistakes to 400", () => {
      expect(classifyS3Error(s3Error("InvalidBucketName", 400))).toMatchObject({
         kind: "invalid",
      });
      expect(classifyS3Error(s3Error("InvalidArgument", 400))).toMatchObject({
         kind: "invalid",
      });
   });

   it("maps network failures to 502 unreachable", () => {
      const unreachable = {
         kind: "upstream",
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
         kind: "upstream",
         message: "Storage request failed",
      });
      expect(classifyS3Error("string error")).toMatchObject({
         kind: "upstream",
      });
      expect(classifyS3Error(undefined)).toMatchObject({
         kind: "upstream",
         name: "Unknown",
      });
   });

   it("reports the error name for logging", () => {
      expect(classifyS3Error(s3Error("NoSuchKey", 404)).name).toBe("NoSuchKey");
      expect(classifyS3Error({ code: "ECONNRESET" }).name).toBe("ECONNRESET");
   });
});

describe("classifyS3Error for a bucket", () => {
   it("reports a bucket-scoped 404 as a missing bucket, not a missing object", () => {
      for (const err of [
         s3Error("NotFound", 404),
         s3Error("NoSuchBucket", 404),
         s3Error("UnknownError", 404),
      ]) {
         expect(classifyS3Error(err, "bucket")).toMatchObject({
            kind: "notFound",
            message: "Bucket not found",
         });
      }
      expect(classifyS3Error(s3Error("NotFound", 404))).toMatchObject({
         message: "Object not found",
      });
   });

   it("leaves everything that isn't a 404 alone", () => {
      expect(
         classifyS3Error(s3Error("AccessDenied", 403), "bucket")
      ).toMatchObject({
         kind: "forbidden",
         message: "The server credentials don't allow this",
      });
      expect(classifyS3Error(s3Error("ECONNREFUSED"), "bucket")).toMatchObject({
         kind: "upstream",
         message: "Couldn't reach the storage endpoint",
      });
      expect(classifyS3Error(s3Error("NoSuchKey", 404), "bucket").name).toBe(
         "NoSuchKey"
      );
   });
});

describe("classifyS3Error for the bucket list", () => {
   it("treats a denied bucket listing as rejected credentials", () => {
      expect(
         classifyS3Error(s3Error("AccessDenied", 403), "bucketList")
      ).toMatchObject({
         kind: "upstream",
         code: ErrorCode.CREDENTIALS_REJECTED,
         name: "AccessDenied",
      });
   });

   it("leaves other failures alone", () => {
      expect(
         classifyS3Error(s3Error("NoSuchBucket", 404), "bucketList")
      ).toMatchObject({
         kind: "notFound",
         message: "Bucket not found",
      });
      expect(
         classifyS3Error(s3Error("ECONNREFUSED"), "bucketList")
      ).toMatchObject({
         kind: "upstream",
         message: "Couldn't reach the storage endpoint",
      });
   });
});
