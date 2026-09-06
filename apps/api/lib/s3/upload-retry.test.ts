import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { streamUpload } from "./upload";

describe("upload transport does not replay ambiguous writes", () => {
   it.each([
      { failAt: "put", failAbortOnce: false },
      { failAt: "create", failAbortOnce: false },
      { failAt: "complete", failAbortOnce: false },
      { failAt: "complete", failAbortOnce: true },
   ])(
      "makes one $failAt attempt and permits cleanup retry: $failAbortOnce",
      async ({ failAt, failAbortOnce }) => {
         const calls: string[] = [];
         const client = new S3Client({
            endpoint: "https://minio.example.com",
            region: "us-east-1",
            forcePathStyle: true,
            credentials: { accessKeyId: "test", secretAccessKey: "test" },
            maxAttempts: 3,
            requestChecksumCalculation: "WHEN_REQUIRED",
            requestHandler: {
               handle: async (request: {
                  method: string;
                  query: Record<string, unknown>;
               }) => {
                  const step =
                     request.method === "DELETE"
                        ? "abort"
                        : Object.hasOwn(request.query, "uploads")
                          ? "create"
                          : request.query.partNumber
                            ? "part"
                            : request.query.uploadId
                              ? "complete"
                              : "put";
                  calls.push(step);
                  if (
                     step === failAt ||
                     (step === "abort" &&
                        failAbortOnce &&
                        calls.filter((call) => call === "abort").length === 1)
                  )
                     return {
                        response: {
                           statusCode: 503,
                           headers: {},
                           body: Readable.from([
                              "<Error><Code>ServiceUnavailable</Code></Error>",
                           ]),
                        },
                     };
                  const body =
                     step === "create"
                        ? "<InitiateMultipartUploadResult><UploadId>upload1</UploadId></InitiateMultipartUploadResult>"
                        : "";
                  return {
                     response: {
                        statusCode: 200,
                        headers: { etag: '"part"' },
                        body: Readable.from(body ? [body] : []),
                     },
                  };
               },
            },
         });
         const size = failAt === "put" ? 1 : 6 * 1024 * 1024;
         await expect(
            streamUpload({
               client,
               bucket: "test",
               key: "file",
               contentType: "application/octet-stream",
               body: Readable.from([Buffer.alloc(size)]),
               contentLength: size,
               partSize: 5 * 1024 * 1024,
               maxBytes: size,
               abortController: new AbortController(),
            })
         ).rejects.toMatchObject({
            $metadata: { httpStatusCode: 503, attempts: 1 },
         });
         expect(calls.filter((step) => step === failAt)).toHaveLength(1);
         if (failAt === "complete")
            expect(calls.filter((step) => step === "abort")).toHaveLength(
               failAbortOnce ? 2 : 1
            );
         expect(await client.config.maxAttempts()).toBe(3);
      }
   );
});
