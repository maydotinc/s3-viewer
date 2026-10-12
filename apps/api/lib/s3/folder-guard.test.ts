import {
   AbortMultipartUploadCommand,
   CopyObjectCommand,
   DeleteObjectsCommand,
   GetObjectCommand,
   HeadBucketCommand,
   HeadObjectCommand,
   ListMultipartUploadsCommand,
   ListObjectVersionsCommand,
   ListObjectsV2Command,
   PutObjectCommand,
   UploadPartCopyCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ErrorCode } from "@s3-viewer/types";
import { beforeEach, describe, expect, it } from "vitest";
import { reply, s3Fixture } from "@/lib/testing/s3-fixture";
import { cloneS3Client } from "./clone-client";
import { parseCopySource, guardFolders, withFolderGuard } from "./folder-guard";
import { encodeCopySource } from "./keys";
import { withRequestBudget } from "./request-budget";

const SERVER = "server12345";
const limited = (run: () => Promise<unknown>) =>
   guardFolders(
      [
         {
            serverId: SERVER,
            bucket: "company",
            folders: ["landing/"],
            owner: false,
         },
         { serverId: SERVER, bucket: "open", folders: null, owner: false },
      ],
      run
   );

let storage: ReturnType<typeof s3Fixture>;
beforeEach(() => {
   storage = s3Fixture(async () => reply(200, undefined));
   withFolderGuard(storage.client, SERVER);
});

const refused = { status: 403, code: ErrorCode.FOLDER_ACCESS };

// fixture replies fail to parse; only whether storage was asked matters.
const reached = async (sent: Promise<unknown>, fixture = storage) => {
   await sent.catch(() => undefined);
   expect(fixture.requests.length).toBeGreaterThan(0);
};

describe("folder guard", () => {
   it.each([
      ["a read", new GetObjectCommand({ Bucket: "company", Key: "private/x" })],
      ["a head", new HeadObjectCommand({ Bucket: "company", Key: "private" })],
      [
         "a write",
         new PutObjectCommand({ Bucket: "company", Key: "landing-2/x" }),
      ],
      [
         "a dot-segment key",
         new GetObjectCommand({ Bucket: "company", Key: "landing/../x" }),
      ],
      [
         "a multipart abort",
         new AbortMultipartUploadCommand({
            Bucket: "company",
            Key: "private/x",
            UploadId: "u",
         }),
      ],
      [
         "a batch delete with one key outside",
         new DeleteObjectsCommand({
            Bucket: "company",
            Delete: { Objects: [{ Key: "landing/a" }, { Key: "private/b" }] },
         }),
      ],
      [
         "a bucket-wide listing",
         new ListObjectsV2Command({ Bucket: "company" }),
      ],
      [
         "a bucket-wide version listing",
         new ListObjectVersionsCommand({ Bucket: "company" }),
      ],
      [
         "a listing prefix that names the parent",
         new ListObjectsV2Command({ Bucket: "company", Prefix: "landing/.." }),
      ],
      [
         "a dot-segment key in a whole-bucket grant",
         new GetObjectCommand({ Bucket: "open", Key: "../company/private/x" }),
      ],
      [
         "a dot-segment listing in a whole-bucket grant",
         new ListObjectsV2Command({ Bucket: "open", Prefix: "../company/" }),
      ],
      [
         "a dot-segment copy source in a whole-bucket grant",
         new CopyObjectCommand({
            Bucket: "open",
            Key: "copy",
            CopySource: "open/../company/private/x",
         }),
      ],
      [
         "a listing above the folder",
         new ListObjectsV2Command({ Bucket: "company", Prefix: "land" }),
      ],
      [
         "a copy from outside the folder",
         new CopyObjectCommand({
            Bucket: "company",
            Key: "landing/copy",
            CopySource: encodeCopySource("company", "private/secret file.txt"),
         }),
      ],
      [
         "a copy out of a limited bucket into an open one",
         new CopyObjectCommand({
            Bucket: "open",
            Key: "anywhere",
            CopySource: encodeCopySource("company", "private/x"),
         }),
      ],
      [
         "a part copy from outside the folder",
         new UploadPartCopyCommand({
            Bucket: "company",
            Key: "landing/big",
            UploadId: "u",
            PartNumber: 1,
            CopySource: "/company/private/x?versionId=3",
         }),
      ],
      [
         "a copy source it cannot read",
         new CopyObjectCommand({
            Bucket: "open",
            Key: "x",
            CopySource: "company/%E0%A4%A",
         }),
      ],
   ])("stops %s before it is sent", async (_what, command) => {
      await expect(
         limited(() => storage.client.send(command as GetObjectCommand))
      ).rejects.toMatchObject(refused);
      expect(storage.requests).toEqual([]);
   });

   it.each([
      [
         "a key in the folder",
         new GetObjectCommand({ Bucket: "company", Key: "landing/a.png" }),
      ],
      [
         "a listing inside the folder",
         new ListObjectsV2Command({ Bucket: "company", Prefix: "landing/im" }),
      ],
      [
         "a copy within the folder",
         new CopyObjectCommand({
            Bucket: "company",
            Key: "landing/b",
            CopySource: encodeCopySource("company", "landing/a b+c%.png"),
         }),
      ],
      ["a bucket probe", new HeadBucketCommand({ Bucket: "company" })],
      [
         "an upload listing, which the caller filters",
         new ListMultipartUploadsCommand({ Bucket: "company" }),
      ],
      [
         "any key in a whole-bucket grant",
         new GetObjectCommand({ Bucket: "open", Key: "private/x" }),
      ],
      [
         "a bucket this request holds no folder limit on",
         new GetObjectCommand({ Bucket: "elsewhere", Key: "x" }),
      ],
   ])("lets %s through", async (_what, command) => {
      await reached(
         limited(() => storage.client.send(command as GetObjectCommand))
      );
   });

   it("leaves the owner free to use dot-segment keys and any listing", async () => {
      const owned = (command: GetObjectCommand) =>
         guardFolders(
            [
               {
                  serverId: SERVER,
                  bucket: "company",
                  folders: null,
                  owner: true,
               },
            ],
            () => storage.client.send(command)
         );
      await reached(
         owned(new GetObjectCommand({ Bucket: "company", Key: "odd/../key" }))
      );
      await reached(
         owned(
            new ListObjectsV2Command({
               Bucket: "company",
            }) as unknown as GetObjectCommand
         )
      );
   });

   it("does nothing outside a guarded request", async () => {
      await reached(
         storage.client.send(
            new GetObjectCommand({ Bucket: "company", Key: "private/x" })
         )
      );
   });

   it("keeps one request's folders from another running alongside it", async () => {
      const other = guardFolders(
         [
            {
               serverId: SERVER,
               bucket: "company",
               folders: ["private/"],
               owner: false,
            },
         ],
         async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return storage.client.send(
               new HeadObjectCommand({ Bucket: "company", Key: "private/x" })
            );
         }
      );
      await expect(
         limited(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return storage.client.send(
               new GetObjectCommand({ Bucket: "company", Key: "private/x" })
            );
         })
      ).rejects.toMatchObject(refused);
      await expect(other).resolves.toBeDefined();
      expect(storage.requests.map(({ path }) => path)).toEqual([
         "/company/private/x",
      ]);
   });

   it("applies to presigned links as well as sent requests", async () => {
      await expect(
         limited(() =>
            getSignedUrl(
               storage.client,
               new GetObjectCommand({ Bucket: "company", Key: "private/x" })
            )
         )
      ).rejects.toMatchObject(refused);
      await expect(
         limited(() =>
            getSignedUrl(
               storage.client,
               new GetObjectCommand({ Bucket: "company", Key: "landing/x" })
            )
         )
      ).resolves.toContain("/company/landing/x");
   });

   it("follows a client into its clones", async () => {
      const base = s3Fixture(async () => reply(200, undefined));
      withFolderGuard(withRequestBudget(base.client, SERVER), SERVER);
      const clone = cloneS3Client(base.client, { maxAttempts: 1 });
      await expect(
         limited(() =>
            clone.send(
               new GetObjectCommand({ Bucket: "company", Key: "private/x" })
            )
         )
      ).rejects.toMatchObject(refused);
      expect(base.requests).toEqual([]);
   });

   it("only applies a server's folders to that server's client", async () => {
      await reached(
         guardFolders(
            [
               {
                  serverId: "another",
                  bucket: "company",
                  folders: ["landing/"],
                  owner: false,
               },
            ],
            () =>
               storage.client.send(
                  new GetObjectCommand({ Bucket: "company", Key: "private/x" })
               )
         )
      );
   });
});

describe("parseCopySource", () => {
   it("reads the bucket and decoded key the app encodes", () => {
      const key = "landing/a b/ü+%?#.png";
      expect(parseCopySource(encodeCopySource("company", key))).toEqual({
         bucket: "company",
         key,
      });
   });

   it("ignores a leading slash and a version suffix", () => {
      expect(parseCopySource("/company/a/b?versionId=1")).toEqual({
         bucket: "company",
         key: "a/b",
      });
   });

   it("refuses what it cannot parse", () => {
      expect(parseCopySource("company")).toBeNull();
      expect(parseCopySource("/key-only")).toBeNull();
      expect(parseCopySource("company/%zz")).toBeNull();
   });
});
