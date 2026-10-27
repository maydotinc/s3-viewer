import {
   HeadObjectCommand,
   ListObjectsV2Command,
   type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { whichExistInFolders } from "./existence";

describe("upload existence and ETag snapshot", () => {
   it("captures HEAD ETags and distinguishes absent keys from existing keys without an ETag", async () => {
      const send = vi.fn(async (command: HeadObjectCommand) => {
         if (command.input.Key === "missing")
            throw Object.assign(new Error(), { name: "NotFound" });
         return command.input.Key === "untagged"
            ? {}
            : { ETag: '"before-confirmation"' };
      });
      const result = await whichExistInFolders(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         null,
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
      const result = await whichExistInFolders(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         null,
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
      const result = await whichExistInFolders(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         null,
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

   it("lists a member's folders side by side, a few at a time", async () => {
      const folders = Array.from({ length: 6 }, (_, i) => `f${i}/`);
      const keys = folders.flatMap((folder) =>
         numbered(60).map((name) => `${folder}${name}`)
      );
      let active = 0;
      let maximum = 0;
      const send = vi.fn(async () => {
         active++;
         maximum = Math.max(maximum, active);
         await new Promise<void>((resolve) => setImmediate(resolve));
         active--;
         return { Contents: [], IsTruncated: false };
      });
      const result = await whichExistInFolders(
         { client: { send } as unknown as S3Client, bucket: "bucket" },
         folders,
         keys
      );
      expect(result.existing).toEqual([]);
      expect(maximum).toBeGreaterThan(1);
      expect(maximum).toBeLessThanOrEqual(4);
   });

   it("aborts the other folder listings once one fails, and waits for them", async () => {
      const folders = ["a/", "b/", "c/"];
      const keys = folders.flatMap((folder) =>
         numbered(60).map((name) => `${folder}${name}`)
      );
      const siblings: AbortSignal[] = [];
      let settled = 0;
      const send = vi.fn(
         async (
            command: ListObjectsV2Command,
            { abortSignal }: { abortSignal: AbortSignal }
         ) => {
            if (command.input.Prefix?.startsWith("a/")) {
               await new Promise<void>((resolve) => setImmediate(resolve));
               throw Object.assign(new Error(), { name: "InternalError" });
            }
            siblings.push(abortSignal);
            await new Promise<void>((resolve) =>
               abortSignal.addEventListener("abort", () => resolve())
            );
            settled++;
            throw abortSignal.reason;
         }
      );
      await expect(
         whichExistInFolders(
            { client: { send } as unknown as S3Client, bucket: "bucket" },
            folders,
            keys
         )
      ).rejects.toMatchObject({ kind: "upstream" });
      expect(siblings).toHaveLength(2);
      expect(siblings.every((signal) => signal.aborted)).toBe(true);
      expect(settled).toBe(2);
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
      ).rejects.toMatchObject({ kind: "forbidden" });
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
         whichExistInFolders({ client, bucket: "bucket" }, null, ["private"])
      ).rejects.toMatchObject({ kind: "forbidden" });
   });
});
