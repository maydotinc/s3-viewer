import {
   HeadObjectCommand,
   ListObjectsV2Command,
   type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { whichExist, whichExistInFolders } from "./existence";

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

   const numbered = (count: number): string[] =>
      Array.from(
         { length: count },
         (_, i) => `file-${String(i).padStart(4, "0")}`
      );
   const unlistable = (exists: (key: string) => boolean) =>
      vi.fn(async (command: ListObjectsV2Command | HeadObjectCommand) => {
         if (!(command instanceof HeadObjectCommand))
            return { Contents: [], IsTruncated: true };
         if (!exists(command.input.Key!))
            throw Object.assign(new Error(), { name: "NotFound" });
         return { ETag: '"observed"' };
      });

   it("resolves a full batch exactly when the listing gives up", async () => {
      const keys = numbered(1000);
      const present = new Set(keys.filter((_, i) => i % 2 === 0));
      const send = unlistable((key) => present.has(key));
      const result = await whichExist(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         keys
      );
      expect(result.existing).toEqual([...present]);
      expect(Object.keys(result.eTags)).toEqual([...present]);
   });

   it("resolves a full batch exactly across a member's folders", async () => {
      const keys = numbered(1000).map(
         (name, i) => `${i % 2 === 0 ? "a/" : "b/"}${name}`
      );
      const send = unlistable((key) => key.startsWith("b/"));
      const result = await whichExistInFolders(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         ["a/", "b/"],
         keys
      );
      expect(result.existing).toHaveLength(500);
      expect(result.existing.every((key) => key.startsWith("b/"))).toBe(true);
      expect(Object.keys(result.eTags)).toHaveLength(500);
   });

   it("keeps a key named __proto__ when merging folder listings", async () => {
      const keys = ["a/__proto__", "__proto__", ...numbered(60)];
      const send = vi.fn(async () => ({
         Contents: keys.map((Key) => ({ Key, ETag: `"${Key}"` })),
         IsTruncated: false,
      }));
      const result = await whichExistInFolders(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         [""],
         keys
      );
      expect(result.existing).toHaveLength(keys.length);
      expect(Object.hasOwn(result.eTags, "__proto__")).toBe(true);
      expect(result.eTags["__proto__"]).toBe('"__proto__"');
   });

   it("refuses keys outside every folder instead of reporting them absent", async () => {
      const send = vi.fn();
      await expect(
         whichExistInFolders(
            { client: { send } as unknown as S3Client, bucket: "bucket" },
            ["a/"],
            numbered(60)
               .map((name) => `a/${name}`)
               .concat("b/outside")
         )
      ).rejects.toMatchObject({ status: 403 });
      expect(send).not.toHaveBeenCalled();
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
