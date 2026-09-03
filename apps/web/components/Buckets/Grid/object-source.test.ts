import type { S3Object, S3ObjectListPage } from "@s3-viewer/types";
import type { IGetRowsParams } from "ag-grid-community";
import { beforeEach, describe, expect, it, vi } from "vitest";

let total = 2500;
const BLOCK = 1000;

const calls: { token: string | null; blockSize: number }[] = [];
let shortFirstPage = false;

const get = vi.fn(async (path: string): Promise<S3ObjectListPage> => {
   const params = new URL(path, "http://x").searchParams;
   const token = params.get("continuationToken");
   const blockSize = Number(params.get("blockSize"));
   calls.push({ token, blockSize });
   const start = token ? Number(token) : 0;
   const take = shortFirstPage && calls.length === 1 ? 600 : blockSize;
   shortFirstPage = false;
   const end = Math.min(total, start + take);
   const objects: S3Object[] = [];
   for (let i = start; i < end; i++) {
      objects.push({
         key: `k${i}`,
         isFolder: false,
         lastModified: null,
         size: 0,
      });
   }
   return { objects, nextToken: end < total ? String(end) : null };
});

vi.mock("@/lib/env", () => ({ publicEnv: { apiOrigin: "", siteOrigin: "" } }));
vi.mock("@/lib/api", () => ({
   api: { get },
   objectsPath: () => "/objects",
   qs: (params: Record<string, string | number | undefined | null>) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
         if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
      }
      return `?${sp.toString()}`;
   },
}));

const { createObjectDatasource } = await import("./object-source");

const source = () =>
   createObjectDatasource({
      serverId: "s",
      bucketName: "b",
      prefix: "",
      foldersFirst: false,
      getGridApi: () => undefined,
      onError: () => undefined,
   });

const rowsFor = (
   datasource: ReturnType<typeof source>,
   block: number
): Promise<{ rows: S3Object[]; lastRow: number | undefined }> =>
   new Promise((resolve, reject) => {
      const params = {
         startRow: block * BLOCK,
         endRow: (block + 1) * BLOCK,
         successCallback: (rows: S3Object[], lastRow?: number) =>
            resolve({ rows, lastRow }),
         failCallback: () => reject(new Error("failed")),
      } as unknown as IGetRowsParams;
      void datasource.getRows(params);
   });

beforeEach(() => {
   calls.length = 0;
   shortFirstPage = false;
   total = 2500;
});

describe("createObjectDatasource", () => {
   it("walks forward through unknown tokens and reports the end once found", async () => {
      const datasource = source();
      const last = await rowsFor(datasource, 2);
      expect(calls.map((c) => c.token)).toEqual([null, "1000", "2000"]);
      expect(last.rows).toHaveLength(500);
      expect(last.rows[0]?.key).toBe("k2000");
      expect(last.lastRow).toBe(total);

      const first = await rowsFor(datasource, 0);
      expect(calls).toHaveLength(4);
      expect(calls[3]).toEqual({ token: null, blockSize: BLOCK });
      expect(first.rows).toHaveLength(BLOCK);
      expect(first.lastRow).toBe(total);
   });

   it("fills a block to size when the API returns a short page with a token", async () => {
      shortFirstPage = true;
      const datasource = source();
      const first = await rowsFor(datasource, 0);
      expect(calls).toEqual([
         { token: null, blockSize: BLOCK },
         { token: "600", blockSize: 400 },
      ]);
      expect(first.rows).toHaveLength(BLOCK);
      expect(first.rows[999]?.key).toBe("k999");
      expect(first.lastRow).toBeUndefined();

      const second = await rowsFor(datasource, 1);
      expect(calls[2]).toEqual({ token: "1000", blockSize: BLOCK });
      expect(second.rows[0]?.key).toBe("k1000");
   });

   it("returns nothing for a block past the known end", async () => {
      const datasource = source();
      await rowsFor(datasource, 2);
      const beyond = await rowsFor(datasource, 3);
      expect(beyond.rows).toEqual([]);
      expect(calls).toHaveLength(3);
   });

   it("fetches a block directly once its token is known, without rejoining the chain", async () => {
      total = 12_500;
      const datasource = source();
      for (let block = 0; block <= 10; block++)
         await rowsFor(datasource, block);
      expect(calls).toHaveLength(11);

      const first = await rowsFor(datasource, 0);
      expect(calls).toHaveLength(12);
      expect(calls[11]).toEqual({ token: null, blockSize: BLOCK });
      expect(first.rows[0]?.key).toBe("k0");

      const middle = await rowsFor(datasource, 5);
      expect(calls).toHaveLength(13);
      expect(calls[12]).toEqual({ token: "5000", blockSize: BLOCK });
      expect(middle.rows[0]?.key).toBe("k5000");
   });

   it("starts over after reset and serialises overlapping requests", async () => {
      const datasource = source();
      const [a, b] = await Promise.all([
         rowsFor(datasource, 0),
         rowsFor(datasource, 1),
      ]);
      expect(a.rows[0]?.key).toBe("k0");
      expect(b.rows[0]?.key).toBe("k1000");
      expect(calls.map((c) => c.token)).toEqual([null, "1000"]);

      datasource.reset();
      await rowsFor(datasource, 0);
      expect(calls).toHaveLength(3);
   });
});
