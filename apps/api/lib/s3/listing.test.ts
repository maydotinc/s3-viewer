import type {
   ListObjectsV2CommandInput,
   ListObjectsV2CommandOutput,
   S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { existingKeys, listKeysPage, listPage } from "./listing";

type Page = Partial<ListObjectsV2CommandOutput>;

const fakeClient = (pages: Page[]) => {
   const inputs: ListObjectsV2CommandInput[] = [];
   const send = vi.fn(async (command: { input: ListObjectsV2CommandInput }) => {
      inputs.push(command.input);
      return pages[inputs.length - 1] ?? {};
   });
   return { client: { send } as unknown as S3Client, inputs };
};

const object = (Key: string, Size = 1) => ({
   Key,
   Size,
   LastModified: new Date("2026-01-01T00:00:00Z"),
});

describe("listPage", () => {
   it("merges folders and objects in key order and skips the folder marker", async () => {
      const { client } = fakeClient([
         {
            CommonPrefixes: [{ Prefix: "docs/b/" }, { Prefix: "docs/d/" }],
            Contents: [
               object("docs/"),
               object("docs/a.txt"),
               object("docs/c.txt"),
            ],
            IsTruncated: false,
         },
      ]);
      const page = await listPage({
         client,
         bucket: "b",
         prefix: "docs/",
         blockSize: 1000,
      });
      expect(page.objects.map((o) => o.key)).toEqual([
         "docs/a.txt",
         "docs/b/",
         "docs/c.txt",
         "docs/d/",
      ]);
      expect(page.objects[1]).toMatchObject({ isFolder: true, size: null });
      expect(page.nextToken).toBeNull();
   });

   it("orders keys by UTF-8 bytes, not UTF-16 units", async () => {
      const { client } = fakeClient([
         {
            CommonPrefixes: [{ Prefix: "\uFE30zz/" }],
            Contents: [object("\u{1F600}aa")],
            IsTruncated: false,
         },
      ]);
      const page = await listPage({
         client,
         bucket: "b",
         prefix: "",
         blockSize: 1000,
      });
      expect(page.objects.map((o) => o.key)).toEqual([
         "\uFE30zz/",
         "\u{1F600}aa",
      ]);
   });

   it("keeps calling S3 for the rows still missing and returns the last token", async () => {
      const { client, inputs } = fakeClient([
         {
            Contents: [object("a"), object("b")],
            IsTruncated: true,
            NextContinuationToken: "t1",
         },
         {
            Contents: [object("c")],
            IsTruncated: true,
            NextContinuationToken: "t2",
         },
      ]);
      const page = await listPage({
         client,
         bucket: "b",
         prefix: "",
         blockSize: 3,
      });
      expect(page.objects.map((o) => o.key)).toEqual(["a", "b", "c"]);
      expect(page.nextToken).toBe("t2");
      expect(inputs.map((i) => i.MaxKeys)).toEqual([3, 1]);
      expect(inputs[1]?.ContinuationToken).toBe("t1");
   });

   it("ends the page when S3 repeats a continuation token", async () => {
      const { client, inputs } = fakeClient([
         {
            Contents: [object("a")],
            IsTruncated: true,
            NextContinuationToken: "same",
         },
         {
            Contents: [object("b")],
            IsTruncated: true,
            NextContinuationToken: "same",
         },
      ]);
      const page = await listPage({
         client,
         bucket: "b",
         prefix: "",
         blockSize: 10,
      });
      expect(page.objects.map((o) => o.key)).toEqual(["a", "b"]);
      expect(page.nextToken).toBeNull();
      expect(inputs).toHaveLength(2);
   });
});

describe("existingKeys", () => {
   // ascii keys only: the mock compares as UTF-16, which only matches S3's
   // UTF-8 ordering below U+0080
   const fakeBucket = (keys: string[], pageSize = 1000) => {
      const stored = [...keys].sort();
      const inputs: ListObjectsV2CommandInput[] = [];
      const send = vi.fn(
         async (command: { input: ListObjectsV2CommandInput }) => {
            const {
               Prefix = "",
               StartAfter = "",
               MaxKeys = 1000,
            } = command.input;
            inputs.push(command.input);
            const matching = stored.filter(
               (key) => key.startsWith(Prefix) && key > StartAfter
            );
            const page = matching.slice(0, Math.min(MaxKeys, pageSize));
            return {
               Contents: page.map((Key) => ({ Key })),
               IsTruncated: page.length < matching.length,
            };
         }
      );
      return { client: { send } as unknown as S3Client, inputs };
   };

   it("answers a whole batch from one listing under the common prefix", async () => {
      const { client, inputs } = fakeBucket(["up/a.txt", "up/c.txt", "other"]);
      const result = await existingKeys({ client, bucket: "b" }, [
         "up/c.txt",
         "up/a.txt",
         "up/b.txt",
      ]);
      expect(result.existing.sort()).toEqual(["up/a.txt", "up/c.txt"]);
      expect(result.unresolved).toEqual([]);
      expect(inputs).toHaveLength(1);
      expect(inputs[0]?.Prefix).toBe("up/");
   });

   it("never sends a prefix cut between the halves of a surrogate pair", async () => {
      const keys = ["\u{1F600}.txt", "\u{1F601}.txt"];
      const { client, inputs } = fakeBucket(keys);
      const result = await existingKeys({ client, bucket: "b" }, keys);

      const prefix = inputs[0]?.Prefix ?? "";
      expect(Buffer.from(prefix, "utf8").toString("utf8")).toBe(prefix);
      expect(result.existing.sort()).toEqual([...keys].sort());
      expect(result.unresolved).toEqual([]);
   });

   it("reports nothing found without a single HeadObject", async () => {
      const { client, inputs } = fakeBucket(["other/a"]);
      expect(
         await existingKeys({ client, bucket: "b" }, ["up/a", "up/b"])
      ).toEqual({
         existing: [],
         eTags: {},
         unresolved: [],
      });
      expect(inputs).toHaveLength(1);
   });

   it("skips past keys nobody asked about instead of paging through them", async () => {
      const { client, inputs } = fakeBucket(
         ["a/1", "a/2", "a/3", "a/4", "a/5", "z/1"],
         3
      );
      const result = await existingKeys({ client, bucket: "b" }, [
         "a/1",
         "z/1",
      ]);
      expect(result.existing.sort()).toEqual(["a/1", "z/1"]);
      expect(result.unresolved).toEqual([]);
      expect(inputs).toHaveLength(2);
      expect(inputs[0]?.Prefix).toBeUndefined();
      expect(inputs[1]?.StartAfter).toBe("z/");
   });

   it("never cuts a surrogate pair in half when it picks StartAfter", async () => {
      const key = "up/a\u{1F600}";
      const { client, inputs } = fakeBucket([key]);
      const result = await existingKeys({ client, bucket: "b" }, [key, "up/b"]);
      expect(inputs[0]?.StartAfter).toBe("up/a");
      expect(result.existing).toEqual([key]);
   });

   it("caps the pages it spends and hands back what it couldn't decide", async () => {
      const keys = Array.from(
         { length: 30 },
         (_, i) => `k${String(i).padStart(2, "0")}`
      );
      const { client, inputs } = fakeBucket(keys, 1);
      const result = await existingKeys({ client, bucket: "b" }, keys);
      expect(inputs).toHaveLength(20);
      expect(result.existing).toHaveLength(20);
      expect(result.unresolved).toEqual(keys.slice(20));
   });
});

describe("listKeysPage", () => {
   it("lists one recursive page of keys and hands back the next token", async () => {
      const { client, inputs } = fakeClient([
         {
            Contents: [{ Key: "f/a" }, { Key: "f/b" }],
            IsTruncated: true,
            NextContinuationToken: "t1",
         },
      ]);
      const page = await listKeysPage({ client, bucket: "b" }, "f/", undefined);
      expect(inputs[0]).toMatchObject({ Prefix: "f/", MaxKeys: 1000 });
      expect(inputs[0]?.Delimiter).toBeUndefined();
      expect(page).toEqual({
         objects: [
            { key: "f/a", expectedETag: null },
            { key: "f/b", expectedETag: null },
         ],
         nextToken: "t1",
      });
   });

   it("rejects a repeated token and accepts a final page", async () => {
      const { client } = fakeClient([
         { Contents: [], IsTruncated: true, NextContinuationToken: "t1" },
         { Contents: [{ Key: "f/c" }], IsTruncated: false },
      ]);
      await expect(
         listKeysPage({ client, bucket: "b" }, "f/", "t1")
      ).rejects.toMatchObject({ status: 502 });
      expect(await listKeysPage({ client, bucket: "b" }, "f/", "t1")).toEqual({
         objects: [{ key: "f/c", expectedETag: null }],
         nextToken: null,
      });
   });
});
