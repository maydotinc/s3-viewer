import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { streamUpload } from "./upload";

type Request = {
   method: string;
   query: Record<string, string>;
   headers: Record<string, string>;
};

describe("replacement permission revocation regressions", () => {
   it.each([
      { endpoint: "https://ceph.example.test", permissions: "ACL grants" },
      {
         endpoint: "https://s3.us-east-1.amazonaws.com",
         permissions: "access tags",
      },
   ])(
      "refuses replacement before it can replay revoked $permissions",
      async ({ endpoint }) => {
         let publicAccess = true;
         let headReads = 0;
         const requests: Request[] = [];
         const owner = "a".repeat(64);
         // This service model reproduced both original failures through the real
         // SDK: revocation after the second settings snapshot followed by a PUT
         // replaying public permissions. A third snapshot has the same race.
         const client = new S3Client({
            endpoint,
            region: "us-east-1",
            credentials: { accessKeyId: "test", secretAccessKey: "test" },
            requestHandler: {
               handle: async (request: Request) => {
                  requests.push(request);
                  let statusCode = 200;
                  let responseBody = "";
                  let headers: Record<string, string> = {};
                  if (request.method === "HEAD") {
                     headReads++;
                     headers = {
                        etag: '"same-content"',
                        "content-length": "8",
                        "content-type": "text/plain",
                     };
                  } else if ("ownershipControls" in request.query) {
                     responseBody =
                        "<OwnershipControls><Rule><ObjectOwnership>BucketOwnerEnforced</ObjectOwnership></Rule></OwnershipControls>";
                  } else if ("acl" in request.query) {
                     responseBody = `<AccessControlPolicy><Owner><ID>${owner}</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>${owner}</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant>${publicAccess ? '<Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AllUsers</URI></Grantee><Permission>READ</Permission></Grant>' : ""}</AccessControlList></AccessControlPolicy>`;
                  } else if ("tagging" in request.query) {
                     responseBody = `<Tagging><TagSet><Tag><Key>access</Key><Value>${publicAccess ? "public" : "private"}</Value></Tag></TagSet></Tagging>`;
                  } else if ("object-lock" in request.query) {
                     statusCode = 404;
                     responseBody =
                        "<Error><Code>ObjectLockConfigurationNotFoundError</Code></Error>";
                     if (headReads === 2) publicAccess = false;
                  } else if (request.method === "PUT") {
                     publicAccess =
                        (request.headers["x-amz-grant-read"] ?? "").includes(
                           "AllUsers"
                        ) ||
                        (request.headers["x-amz-tagging"] ?? "").includes(
                           "public"
                        );
                     headers = { etag: '"new-content"' };
                  }
                  return {
                     response: {
                        statusCode,
                        headers,
                        body: Readable.from([responseBody]),
                     },
                  };
               },
            },
         });
         const body = Readable.from([Buffer.alloc(8)]);
         await expect(
            streamUpload({
               client,
               bucket: "photos",
               key: "private.txt",
               expectedETag: '"same-content"',
               body,
               contentLength: 8,
               contentType: "text/plain",
               partSize: 5 * 1024 ** 2,
               maxBytes: 10 * 1024 ** 2,
               abortController: new AbortController(),
            })
         ).rejects.toMatchObject({ status: 409 });
         expect(requests).toEqual([]);
         expect(body.readableDidRead).toBe(false);
      }
   );
});
