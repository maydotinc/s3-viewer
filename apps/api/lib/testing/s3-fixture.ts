import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { Readable } from "node:stream";

type FixtureRequest = {
   hostname: string;
   method: string;
   path: string;
   headers: Record<string, string>;
   query: Record<string, string>;
   body?: unknown;
};
type FixtureReply = {
   response: {
      statusCode: number;
      headers: Record<string, string>;
      body: unknown;
   };
};
type FixtureHandle = (
   request: FixtureRequest,
   options: { abortSignal?: AbortSignal }
) => Promise<FixtureReply>;
type FixtureOptions = {
   endpoint?: string;
   region?: string;
   bucket?: string;
   maxAttempts?: number;
   forcePathStyle?: boolean;
   credentials?: S3ClientConfig["credentials"];
   requestChecksumCalculation?: "WHEN_REQUIRED" | "WHEN_SUPPORTED";
};

const AWS_ENDPOINT = "https://s3.us-east-1.amazonaws.com";
const MINIO_ENDPOINT = "https://minio.example.com";
const R2_ENDPOINT = "https://account.r2.cloudflarestorage.com";
const PROVIDER_ENDPOINTS: Readonly<Record<Provider, string>> = {
   [Provider.S3]: AWS_ENDPOINT,
   [Provider.R2]: R2_ENDPOINT,
   [Provider.Other]: MINIO_ENDPOINT,
};

const reply = (
   statusCode: number,
   body?: unknown,
   headers: Record<string, string> = {}
): FixtureReply => ({
   response: {
      statusCode,
      headers,
      body: typeof body === "string" ? Readable.from(body ? [body] : []) : body,
   },
});

const xml = (body: string, statusCode = 200): FixtureReply =>
   reply(statusCode, `<?xml version="1.0" encoding="UTF-8"?>${body}`, {
      "content-type": "application/xml",
   });

const errorXml = (code: string): string =>
   `<Error><Code>${code}</Code></Error>`;

const initiatedXml = (uploadId: string): string =>
   `<InitiateMultipartUploadResult><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`;

const completedXml = (eTag: string): string =>
   `<CompleteMultipartUploadResult><ETag>${eTag}</ETag></CompleteMultipartUploadResult>`;

const copiedXml = (eTag: string): string =>
   `<CopyObjectResult><ETag>${eTag}</ETag></CopyObjectResult>`;

const copiedPartXml = (eTag: string): string =>
   `<CopyPartResult><ETag>${eTag}</ETag></CopyPartResult>`;

const deleteResultXml = (
   deleted: readonly string[],
   errors: readonly { key: string; code: string }[] = []
): string =>
   '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
   deleted.map((key) => `<Deleted><Key>${key}</Key></Deleted>`).join("") +
   errors
      .map(
         ({ key, code }) =>
            `<Error><Key>${key}</Key><Code>${code}</Code></Error>`
      )
      .join("") +
   "</DeleteResult>";

const empty = (
   statusCode = 200,
   headers: Record<string, string> = {}
): FixtureReply => reply(statusCode, "", headers);

const listing = (
   contents: { key: string; size: number }[],
   next?: string
): FixtureReply =>
   xml(
      `<ListBucketResult><Name>bucket</Name><IsTruncated>${Boolean(next)}</IsTruncated>` +
         (next
            ? `<NextContinuationToken>${next}</NextContinuationToken>`
            : "") +
         contents
            .map(
               ({ key, size }) =>
                  `<Contents><Key>${key}</Key><Size>${size}</Size><ETag>&quot;e&quot;</ETag></Contents>`
            )
            .join("") +
         `</ListBucketResult>`
   );

// a real S3Client whose transport is `handle`, so SDK serialization and parsing run for real.
const s3Fixture = (handle: FixtureHandle, options: FixtureOptions = {}) => {
   const requests: FixtureRequest[] = [];
   const client = new S3Client({
      endpoint: options.endpoint ?? MINIO_ENDPOINT,
      region: options.region ?? "us-east-1",
      forcePathStyle: options.forcePathStyle ?? true,
      credentials: options.credentials ?? {
         accessKeyId: "test",
         secretAccessKey: "test",
      },
      // retries wait through real SDK backoff, so a test opts in only when retrying is what it checks.
      maxAttempts: options.maxAttempts ?? 1,
      ...(options.requestChecksumCalculation && {
         requestChecksumCalculation: options.requestChecksumCalculation,
      }),
      requestHandler: {
         handle: async (
            request: FixtureRequest,
            handlerOptions: { abortSignal?: AbortSignal } = {}
         ) => {
            requests.push(request);
            return handle(request, handlerOptions);
         },
      },
   });
   return {
      client,
      requests,
      scope: { client, bucket: options.bucket ?? "bucket" },
   };
};

const endpointStub = <Send>(
   send: Send,
   hostname = "s3.us-east-1.amazonaws.com"
) => ({
   config: { endpoint: async () => ({ protocol: "https:", hostname }) },
   send,
});

export {
   AWS_ENDPOINT,
   MINIO_ENDPOINT,
   PROVIDER_ENDPOINTS,
   R2_ENDPOINT,
   completedXml,
   copiedPartXml,
   copiedXml,
   deleteResultXml,
   empty,
   endpointStub,
   errorXml,
   initiatedXml,
   listing,
   reply,
   s3Fixture,
   xml,
};
export type { FixtureHandle, FixtureReply, FixtureRequest };
