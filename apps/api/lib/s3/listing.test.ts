import type {
   ListObjectsV2CommandInput,
   ListObjectsV2CommandOutput,
   S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { listKeysPage, listPage } from "./listing";

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

describe("listKeysPage", () => {
   it("lists one recursive page of keys and hands back the next token", async () => {
      const { client, inputs } = fakeClient([
         {
            Contents: [{ Key: "f/a" }, { Key: "f/b" }],
            IsTruncated: true,
            NextContinuationToken: "t1",
         },
      ]);
      const page = await listKeysPage(client, "b", "f/", undefined);
      expect(inputs[0]).toMatchObject({ Prefix: "f/", MaxKeys: 1000 });
      expect(inputs[0]?.Delimiter).toBeUndefined();
      expect(page).toEqual({ keys: ["f/a", "f/b"], nextToken: "t1" });
   });

   it("ends on a repeated token or a final page", async () => {
      const { client } = fakeClient([
         { Contents: [], IsTruncated: true, NextContinuationToken: "t1" },
         { Contents: [{ Key: "f/c" }], IsTruncated: false },
      ]);
      expect(await listKeysPage(client, "b", "f/", "t1")).toEqual({
         keys: [],
         nextToken: null,
      });
      expect(await listKeysPage(client, "b", "f/", "t1")).toEqual({
         keys: ["f/c"],
         nextToken: null,
      });
   });
});
