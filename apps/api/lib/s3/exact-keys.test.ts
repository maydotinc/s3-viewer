import {
   CopyObjectCommand,
   GetObjectCommand,
   HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
   AWS_ENDPOINT,
   copiedXml,
   reply,
   s3Fixture,
} from "@/lib/testing/s3-fixture";
import { collectArchiveEntries } from "./archive/entries";
import { encodeCopySource } from "./keys";
import { listPage } from "./listing";
import { listMultipartUploads } from "./multipart-listing";
import { presignedUrl } from "./presign";

const bucket = "authorized-bucket";
const eTag = '"reviewed"';
const keys = [
   "a//b.txt",
   "/abs.txt",
   "./x",
   "a/../b.txt",
   "../other/key",
   "tab\tname",
   "nul\0name",
   "%2E%2E/x",
];
const encoded = (key: string) =>
   key.split("/").map(encodeURIComponent).join("/");
const clientFor = (forcePathStyle: boolean, body = "") =>
   s3Fixture(
      async (request) =>
         reply(200, request.method === "PUT" ? copiedXml('"copied"') : body, {
            etag: eTag,
            "content-type": "application/xml",
         }),
      { endpoint: AWS_ENDPOINT, forcePathStyle }
   );

describe.each([true, false])(
   "exact storage key transport (path style: %s)",
   (pathStyle) => {
      it.each(keys)(
         "preserves %j in read paths and source-copy headers",
         async (key) => {
            const { client, requests } = clientFor(pathStyle);
            try {
               await client.send(
                  new HeadObjectCommand({ Bucket: bucket, Key: key })
               );
               const object = await client.send(
                  new GetObjectCommand({ Bucket: bucket, Key: key })
               );
               (object.Body as Readable).destroy();
               await client.send(
                  new CopyObjectCommand({
                     Bucket: bucket,
                     Key: "copy.txt",
                     CopySource: encodeCopySource(bucket, key),
                  })
               );
               const path = `${pathStyle ? `/${bucket}` : ""}/${encoded(key)}`;
               expect(
                  requests.slice(0, 2).map((request) => request.path)
               ).toEqual([path, path]);
               expect(requests[2]?.headers["x-amz-copy-source"]).toBe(
                  `${bucket}/${encoded(key)}`
               );
               expect(
                  requests.every(
                     (request) =>
                        request.hostname ===
                        (pathStyle
                           ? "s3.us-east-1.amazonaws.com"
                           : `${bucket}.s3.us-east-1.amazonaws.com`)
                  )
               ).toBe(true);
            } finally {
               client.destroy();
            }
         }
      );

      it.each([".", "..", "./x", "a/../b", "../other/key"])(
         "refuses browser links that would normalize %j",
         async (key) => {
            const { client } = clientFor(pathStyle);
            try {
               await expect(
                  presignedUrl(
                     client,
                     new GetObjectCommand({ Bucket: bucket, Key: key })
                  )
               ).rejects.toMatchObject({ kind: "conflict" });
            } finally {
               client.destroy();
            }
         }
      );

      it.each(["a//b.txt", "/abs.txt", "tab\tname", "nul\0name", "%2E%2E/x"])(
         "preserves %j when a browser parses a signed URL",
         async (key) => {
            const { client } = clientFor(pathStyle);
            try {
               const { url } = await presignedUrl(
                  client,
                  new GetObjectCommand({ Bucket: bucket, Key: key })
               );
               expect(new URL(url).pathname).toBe(
                  `${pathStyle ? `/${bucket}` : ""}/${encoded(key)}`
               );
            } finally {
               client.destroy();
            }
         }
      );
   }
);

describe("encoded listings", () => {
   it("decodes keys and prefixes exactly once without decoding opaque pagination tokens", async () => {
      const { client, requests } = clientFor(
         true,
         "<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>true</IsTruncated><NextContinuationToken>opaque%2Ftoken</NextContinuationToken><Contents><Key>nul%00name</Key><Size>1</Size></Contents><Contents><Key>%252E%252E%2Fx</Key><Size>1</Size></Contents><CommonPrefixes><Prefix>%2Ftab%09%2F</Prefix></CommonPrefixes></ListBucketResult>"
      );
      try {
         const page = await listPage({
            client,
            bucket,
            prefix: "",
            blockSize: 3,
         });
         expect(page.objects.map(({ key }) => key)).toEqual(
            expect.arrayContaining(["nul\0name", "%2E%2E/x", "/tab\t/"])
         );
         expect(page.nextToken).toBe("opaque%2Ftoken");
         expect(requests[0]?.query["encoding-type"]).toBe("url");
      } finally {
         client.destroy();
      }
   });

   it("reads a plus as the space it encodes and %2B as a literal plus", async () => {
      const { client } = clientFor(
         true,
         "<ListBucketResult><EncodingType>url</EncodingType><Contents><Key>c%2B%2B+notes.txt</Key><Size>1</Size></Contents><Contents><Key>q3+report.pdf</Key><Size>1</Size></Contents><CommonPrefixes><Prefix>tax+returns%2F</Prefix></CommonPrefixes></ListBucketResult>"
      );
      try {
         const page = await listPage({
            client,
            bucket,
            prefix: "",
            blockSize: 3,
         });
         expect(page.objects.map(({ key }) => key)).toEqual([
            "c++ notes.txt",
            "q3 report.pdf",
            "tax returns/",
         ]);
      } finally {
         client.destroy();
      }
   });

   it("rejects malformed encoded keys rather than changing identity", async () => {
      const { client } = clientFor(
         true,
         "<ListBucketResult><EncodingType>url</EncodingType><Contents><Key>%ZZ</Key><Size>1</Size></Contents></ListBucketResult>"
      );
      try {
         await expect(
            listPage({ client, bucket, prefix: "", blockSize: 3 })
         ).rejects.toMatchObject({ kind: "upstream" });
      } finally {
         client.destroy();
      }
   });
});

describe("encoded multipart and archive names", () => {
   it("decodes multipart key markers once and keeps upload identifiers opaque", async () => {
      const { client, requests } = clientFor(
         true,
         "<ListMultipartUploadsResult><EncodingType>url</EncodingType><IsTruncated>true</IsTruncated><NextKeyMarker>%09%2Fname%252F</NextKeyMarker><NextUploadIdMarker>upload%2Fopaque</NextUploadIdMarker><Upload><Key>%09%2Fname%252F</Key><UploadId>upload%2Fopaque</UploadId></Upload></ListMultipartUploadsResult>"
      );
      try {
         const page = await listMultipartUploads(
            { client, bucket },
            "server12345",
            { prefix: "\t/" }
         );
         expect(page.uploads[0]?.key).toBe("\t/name%2F");
         expect(page.nextKeyMarker).toBe("\t/name%2F");
         expect(page.nextUploadIdMarker).toBe("upload%2Fopaque");
         expect(requests[0]?.query["encoding-type"]).toBe("url");
      } finally {
         client.destroy();
      }
   });

   it("keeps original archive source keys while making control-character entry names distinct", async () => {
      const { client } = clientFor(
         true,
         "<ListBucketResult><EncodingType>url</EncodingType><Contents><Key>dir%2Fnul%00name</Key><Size>1</Size></Contents><Contents><Key>dir%2Fnul_name</Key><Size>1</Size></Contents></ListBucketResult>"
      );
      try {
         const { entries } = await collectArchiveEntries(
            { client, bucket },
            ["dir/"],
            { maxObjects: 10, maxBytes: 10 }
         );
         expect(entries.map(({ key }) => key)).toEqual([
            "dir/nul\0name",
            "dir/nul_name",
         ]);
         expect(entries.map(({ name }) => name)).toEqual([
            "dir/nul_name",
            "dir/nul_name.2",
         ]);
      } finally {
         client.destroy();
      }
   });
});
