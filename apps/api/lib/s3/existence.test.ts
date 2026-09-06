import {
   HeadObjectCommand,
   ListObjectsV2Command,
   type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { whichExist } from "./existence";

describe("upload existence and ETag snapshot", () => {
   it("captures HEAD ETags and distinguishes absent keys from existing keys without an ETag", async () => {
      const send = vi.fn(async (command: HeadObjectCommand) => {
         if (command.input.Key === "missing")
            throw Object.assign(new Error(), { name: "NotFound" });
         return command.input.Key === "untagged"
            ? {}
            : { ETag: '"before-confirmation"' };
      });
      const result = await whichExist(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         ["existing", "missing", "untagged", "__proto__"]
      );
      expect(result.existing).toEqual(["existing", "untagged", "__proto__"]);
      expect(result.eTags.existing).toBe('"before-confirmation"');
      expect(Object.hasOwn(result.eTags, "untagged")).toBe(false);
      expect(Object.hasOwn(result.eTags, "__proto__")).toBe(true);
      expect(result.eTags["__proto__"]).toBe('"before-confirmation"');
   });

   it("captures listing ETags without issuing one HEAD per existing key", async () => {
      const keys = Array.from({ length: 60 }, (_, i) => `file-${i}`);
      const send = vi.fn(async (command: ListObjectsV2Command) => {
         expect(command).toBeInstanceOf(ListObjectsV2Command);
         return {
            Contents: keys.map((Key) => ({ Key, ETag: `"${Key}"` })),
            IsTruncated: false,
         };
      });
      const result = await whichExist(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         keys
      );
      expect(result.existing).toHaveLength(60);
      expect(result.eTags["file-30"]).toBe('"file-30"');
      expect(send).toHaveBeenCalledTimes(1);
   });

   it("does not manufacture replacement authority when the lookup budget is exhausted", async () => {
      const keys = Array.from(
         { length: 1000 },
         (_, i) => `file-${String(i).padStart(4, "0")}`
      );
      const send = vi.fn(
         async (command: ListObjectsV2Command | HeadObjectCommand) => {
            if (command instanceof HeadObjectCommand)
               return { ETag: '"observed"' };
            return { Contents: [], IsTruncated: true };
         }
      );
      const result = await whichExist(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         keys
      );
      expect(result.existing).toHaveLength(1000);
      expect(Object.keys(result.eTags)).toHaveLength(200);
      expect(Object.hasOwn(result.eTags, "file-0999")).toBe(false);
   });

   it("fails closed on HEAD permission errors", async () => {
      const client = {
         send: vi
            .fn()
            .mockRejectedValue(
               Object.assign(new Error(), { name: "AccessDenied" })
            ),
      } as unknown as S3Client;
      await expect(
         whichExist({ client, bucket: "bucket" }, ["private"])
      ).rejects.toMatchObject({ status: 403 });
   });
});
