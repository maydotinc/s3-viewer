import type { S3Object, S3ObjectListPage } from "@s3-viewer/shared";
import type { GridApi, IGetRowsParams } from "ag-grid-community";
import { beforeEach, describe, expect, it, vi } from "vitest";

let total = 2500;
const BLOCK = 1000;

const calls: { token: string | null; blockSize: number }[] = [];
let shortFirstPage = false;
let pageLimit: number | null = null;
let emptyFromCall: number | null = null;
let folderAt = new Set<number>();

const get = vi.fn(
   async (path: string, _signal?: AbortSignal): Promise<S3ObjectListPage> => {
      const params = new URL(path, "http://x").searchParams;
      const token = params.get("continuationToken");
      const blockSize = Number(params.get("blockSize"));
      calls.push({ token, blockSize });
      const start = token ? Number(token) : 0;
      if (emptyFromCall !== null && calls.length > emptyFromCall)
         return { objects: [], nextToken: String(start) };
      const take = shortFirstPage
         ? 600
         : Math.min(blockSize, pageLimit ?? blockSize);
      shortFirstPage = shortFirstPage && calls.length !== 1;
      const end = Math.min(total, start + take);
      const objects: S3Object[] = [];
      for (let i = start; i < end; i++) {
         objects.push({
            key: folderAt.has(i) ? `k${i}/` : `k${i}`,
            isFolder: folderAt.has(i),
            eTag: '"original"',
            lastModified: null,
            size: 0,
         });
      }
      return { objects, nextToken: end < total ? String(end) : null };
   }
);

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

const { createObjectDatasource, prefetchFirstBlock } = await import(
   "./object-source"
);

const source = (
   overrides: Partial<Parameters<typeof createObjectDatasource>[0]> = {}
) =>
   createObjectDatasource({
      serverId: "s",
      bucketName: "b",
      prefix: "",
      foldersFirst: false,
      getGridApi: () => undefined,
      onError: () => undefined,
      ...overrides,
   });

const blockedPage = (honorAbort = true) => {
   let resolve!: (page: S3ObjectListPage) => void;
   let reject!: (error: unknown) => void;
   const page = new Promise<S3ObjectListPage>((done, fail) => {
      resolve = done;
      reject = fail;
   });
   let started!: (signal: AbortSignal | undefined) => void;
   const signal = new Promise<AbortSignal | undefined>((done) => {
      started = done;
   });
   get.mockImplementationOnce((_path, signal) => {
      if (honorAbort)
         signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
         });
      started(signal);
      return page;
   });
   return { signal, resolve, reject };
};

const rowRequest = (datasource: ReturnType<typeof source>, block = 0) => {
   const successCallback = vi.fn();
   const failCallback = vi.fn();
   const done = datasource.getRows({
      startRow: block * BLOCK,
      endRow: (block + 1) * BLOCK,
      successCallback,
      failCallback,
   } as unknown as IGetRowsParams);
   return { successCallback, failCallback, done };
};

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
   get.mockClear();
   calls.length = 0;
   shortFirstPage = false;
   pageLimit = null;
   emptyFromCall = null;
   folderAt = new Set();
   total = 2500;
});

describe("first block hooks", () => {
   const entry = (key: string): S3Object => ({
      key,
      isFolder: key.endsWith("/"),
      eTag: null,
      lastModified: null,
      size: 0,
   });

   it("reports the first block's keys in listing order, before folders are pulled to the top", async () => {
      get.mockImplementationOnce(async () => ({
         objects: [entry("b.txt"), entry("a/")],
         nextToken: null,
      }));
      const onFirstPage = vi.fn();
      const first = await rowsFor(
         source({ foldersFirst: true, onFirstPage }),
         0
      );
      expect(first.rows.map((row) => row.key)).toEqual(["a/", "b.txt"]);
      expect(onFirstPage).toHaveBeenCalledExactlyOnceWith(["b.txt", "a/"]);
   });

   it("reports keys for the first block only", async () => {
      const onFirstPage = vi.fn();
      await rowsFor(source({ onFirstPage }), 1);
      expect(onFirstPage).toHaveBeenCalledOnce();
      expect(onFirstPage.mock.calls[0]![0]).toHaveLength(BLOCK);
      expect(onFirstPage.mock.calls[0]![0][0]).toBe("k0");
   });
});

describe("folders first across blocks", () => {
   it("moves a folder found in block two above block one's files", async () => {
      total = 2000;
      folderAt = new Set([5, 1500]);
      const { grid, getGridApi } = liveGrid();
      const datasource = source({ foldersFirst: true, getGridApi });

      const first = await rowsFor(datasource, 0);
      expect(first.rows.slice(0, 2).map((row) => row.key)).toEqual([
         "k5/",
         "k0",
      ]);
      expect(grid.refreshInfiniteCache).not.toHaveBeenCalled();

      const second = await rowsFor(datasource, 1);
      expect(grid.refreshInfiniteCache).toHaveBeenCalledOnce();
      expect(second.lastRow).toBe(total);
      const resorted = await rowsFor(datasource, 0);
      expect(calls.map((c) => c.token)).toEqual([null, "1000"]);

      const keys = [...resorted.rows, ...second.rows].map((row) => row.key);
      expect(keys.slice(0, 3)).toEqual(["k5/", "k1500/", "k0"]);
      expect(new Set(keys).size).toBe(total);
      expect(keys.slice(2).filter((key) => key.endsWith("/"))).toEqual([]);
   });

   it("re-sorts once after a reload instead of once per page that brings folders", async () => {
      total = 3000;
      folderAt = new Set([1500, 2500]);
      const blocks: Record<string, { pageStatus: string }> = {
         0: { pageStatus: "loaded" },
         1: { pageStatus: "loaded" },
         2: { pageStatus: "needsLoading" },
      };
      const { grid, getGridApi } = liveGrid({ blocks });
      const datasource = source({ foldersFirst: true, getGridApi });
      datasource.reload();
      expect(grid.refreshInfiniteCache).toHaveBeenCalledOnce();
      await rowsFor(datasource, 0);
      await rowsFor(datasource, 1);
      expect(grid.refreshInfiniteCache).toHaveBeenCalledOnce();
      blocks[2] = { pageStatus: "loaded" };
      await rowsFor(datasource, 2);
      expect(grid.refreshInfiniteCache).toHaveBeenCalledTimes(2);
   });

   it("refetches a block that fell out of the window and reloads once it disagrees with the walk", async () => {
      total = 26_000;
      const { grid, getGridApi } = liveGrid();
      const onError = vi.fn();
      const datasource = source({ foldersFirst: true, getGridApi, onError });
      await rowsFor(datasource, 25);
      expect(calls).toHaveLength(26);

      const first = await rowsFor(datasource, 0);
      expect(calls).toHaveLength(27);
      expect(first.rows[0]?.key).toBe("k0");
      expect(grid.refreshInfiniteCache).not.toHaveBeenCalled();

      folderAt = new Set([1005]);
      const changed = rowRequest(datasource, 1);
      await changed.done;
      expect(changed.successCallback).not.toHaveBeenCalled();
      expect(changed.failCallback).toHaveBeenCalledOnce();
      expect(onError).not.toHaveBeenCalled();
      expect(grid.refreshInfiniteCache).toHaveBeenCalledOnce();
   });

   it("re-sorts nothing when later blocks hold no folders", async () => {
      folderAt = new Set([3]);
      const { grid, getGridApi } = liveGrid();
      const datasource = source({ foldersFirst: true, getGridApi });
      await rowsFor(datasource, 0);
      const last = await rowsFor(datasource, 2);
      expect(grid.refreshInfiniteCache).not.toHaveBeenCalled();
      expect(last.rows).toHaveLength(500);
      expect(last.rows[0]?.key).toBe("k2000");
   });
});

describe("createObjectDatasource", () => {
   it("walks forward through unknown tokens and reports the end once found", async () => {
      const datasource = source();
      const last = await rowsFor(datasource, 2);
      expect(calls.map((c) => c.token)).toEqual([null, "1000", "2000"]);
      expect(last.rows).toHaveLength(500);
      expect(last.rows[0]?.key).toBe("k2000");
      expect(last.lastRow).toBe(total);
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

   it("stops a block that stops making progress and reports it as the end", async () => {
      pageLimit = 40;
      emptyFromCall = 1;
      const datasource = source();
      const first = await rowsFor(datasource, 0);
      expect(calls).toHaveLength(21);
      expect(first.rows).toHaveLength(40);
      expect(first.lastRow).toBe(40);
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

   it("aborts a blocked walk and settles its queued grid requests on destroy", async () => {
      const onError = vi.fn();
      const grid = { showNoRowsOverlay: vi.fn(), hideOverlay: vi.fn() };
      const datasource = source({
         onError,
         getGridApi: () => grid as unknown as GridApi,
      });
      const blocked = blockedPage();
      const request = rowRequest(datasource, 2);
      const queued = rowRequest(datasource, 3);
      const signal = await blocked.signal;
      expect(signal?.aborted).toBe(false);

      datasource.destroy();
      await Promise.all([request.done, queued.done]);

      expect(signal?.aborted).toBe(true);
      expect(get).toHaveBeenCalledTimes(1);
      for (const obsolete of [request, queued]) {
         expect(obsolete.successCallback).not.toHaveBeenCalled();
         expect(obsolete.failCallback).toHaveBeenCalledOnce();
      }
      expect(onError).not.toHaveBeenCalled();
      expect(grid.showNoRowsOverlay).not.toHaveBeenCalled();
      expect(grid.hideOverlay).not.toHaveBeenCalled();

      const replacement = source();
      const current = await rowsFor(replacement, 0);
      expect(current.rows[0]?.key).toBe("k0");
      const nextSignal = get.mock.calls.at(-1)?.[1];
      expect(nextSignal).not.toBe(signal);
      expect(nextSignal?.aborted).toBe(false);
   });

   it("never starts delayed grid requests after destruction", async () => {
      const onError = vi.fn();
      const datasource = source({ onError });
      datasource.destroy();
      const delayed = rowRequest(datasource);
      await delayed.done;
      expect(get).not.toHaveBeenCalled();
      expect(delayed.successCallback).not.toHaveBeenCalled();
      expect(delayed.failCallback).toHaveBeenCalledOnce();
      expect(onError).not.toHaveBeenCalled();
   });

   it.each([0, 2])(
      "ignores a late successful page for obsolete block %s even if transport ignores abort",
      async (block) => {
         const onError = vi.fn();
         const onFirstPage = vi.fn();
         const grid = { showNoRowsOverlay: vi.fn(), hideOverlay: vi.fn() };
         const datasource = source({
            onError,
            onFirstPage,
            getGridApi: () => grid as unknown as GridApi,
         });
         const blocked = blockedPage(false);
         const request = rowRequest(datasource, block);
         await blocked.signal;
         datasource.destroy();
         const current = await rowsFor(
            source({ getGridApi: () => grid as unknown as GridApi }),
            0
         );
         blocked.resolve({ objects: [], nextToken: "obsolete" });
         await request.done;

         expect(get).toHaveBeenCalledTimes(2);
         expect(current.rows).toHaveLength(BLOCK);
         expect(request.successCallback).not.toHaveBeenCalled();
         expect(request.failCallback).toHaveBeenCalledOnce();
         expect(onError).not.toHaveBeenCalled();
         expect(onFirstPage).not.toHaveBeenCalled();
         expect(grid.showNoRowsOverlay).not.toHaveBeenCalled();
         expect(grid.hideOverlay).toHaveBeenCalledTimes(1);
      }
   );

   it("preserves failures from the current generation", async () => {
      const error = new Error("listing failed");
      const onError = vi.fn();
      const datasource = source({ onError });
      get.mockRejectedValueOnce(error);
      const request = rowRequest(datasource);
      await request.done;
      expect(request.successCallback).not.toHaveBeenCalled();
      expect(request.failCallback).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(error);
   });
});

const liveGrid = (
   overrides: {
      blocks?: Record<string, { pageStatus: string }>;
      selected?: string[];
      present?: string[];
   } = {}
) => {
   const grid = {
      isDestroyed: vi.fn(() => false),
      isLastRowIndexKnown: vi.fn(() => true),
      getInfiniteRowCount: vi.fn(() => total),
      setRowCount: vi.fn(),
      refreshInfiniteCache: vi.fn(),
      showNoRowsOverlay: vi.fn(),
      hideOverlay: vi.fn(),
      getCacheBlockState: vi.fn(
         () => overrides.blocks ?? { 0: { pageStatus: "loaded" } }
      ),
      forEachNode: vi.fn((visit: (node: { id?: string }) => void) => {
         for (const id of overrides.present ?? []) visit({ id });
         visit({});
      }),
      getSelectedNodes: vi.fn(() =>
         (overrides.selected ?? []).map((id) => ({ id }))
      ),
      setNodesSelected: vi.fn(),
   };
   return { grid, getGridApi: () => grid as unknown as GridApi };
};

describe("reloading in place", () => {
   it("refreshes the live grid and walks the listing again from the start", async () => {
      const { grid, getGridApi } = liveGrid();
      const datasource = source({ getGridApi });
      await rowsFor(datasource, 2);
      expect(calls.map((c) => c.token)).toEqual([null, "1000", "2000"]);

      datasource.reload();
      expect(grid.setRowCount).toHaveBeenCalledExactlyOnceWith(total, false);
      expect(grid.refreshInfiniteCache).toHaveBeenCalledOnce();
      expect(grid.setRowCount.mock.invocationCallOrder[0]).toBeLessThan(
         grid.refreshInfiniteCache.mock.invocationCallOrder[0]!
      );

      const last = await rowsFor(datasource, 2);
      expect(calls.slice(3).map((c) => c.token)).toEqual([
         null,
         "1000",
         "2000",
      ]);
      expect(last.lastRow).toBe(total);
   });

   it("keeps the row count when the end was not yet found", () => {
      const { grid, getGridApi } = liveGrid();
      grid.isLastRowIndexKnown.mockReturnValue(false);
      source({ getGridApi }).reload();
      expect(grid.setRowCount).not.toHaveBeenCalled();
      expect(grid.refreshInfiniteCache).toHaveBeenCalledOnce();
   });

   it("only resets its listing once the grid is gone", () => {
      const { grid, getGridApi } = liveGrid();
      grid.isDestroyed.mockReturnValue(true);
      source({ getGridApi }).reload();
      expect(grid.refreshInfiniteCache).not.toHaveBeenCalled();
   });

   it("settles requests from before the reload without reporting an error", async () => {
      const onError = vi.fn();
      const datasource = source({ onError });
      const blocked = blockedPage();
      const request = rowRequest(datasource);
      const signal = await blocked.signal;
      datasource.reload();
      await request.done;
      expect(signal?.aborted).toBe(true);
      expect(request.successCallback).not.toHaveBeenCalled();
      expect(request.failCallback).toHaveBeenCalledOnce();
      expect(onError).not.toHaveBeenCalled();
   });

   it("deselects rows that vanished once every reloaded block is back", async () => {
      const blocks: Record<string, { pageStatus: string }> = {
         0: { pageStatus: "loaded" },
         1: { pageStatus: "needsLoading" },
      };
      const { grid, getGridApi } = liveGrid({
         blocks,
         selected: ["k1", "k1500", "deleted"],
         present: ["k1", "k1500"],
      });
      const datasource = source({ getGridApi });
      datasource.reload();
      await rowsFor(datasource, 0);
      expect(grid.setNodesSelected).not.toHaveBeenCalled();

      blocks[1] = { pageStatus: "loaded" };
      await rowsFor(datasource, 1);
      expect(grid.setNodesSelected).toHaveBeenCalledExactlyOnceWith({
         nodes: [{ id: "deleted" }],
         newValue: false,
      });

      await rowsFor(datasource, 0);
      expect(grid.setNodesSelected).toHaveBeenCalledOnce();
   });

   it("refreshes selection snapshots from the grid once the reload settles", async () => {
      const blocks: Record<string, { pageStatus: string }> = {
         0: { pageStatus: "loaded" },
         1: { pageStatus: "needsLoading" },
      };
      const { grid, getGridApi } = liveGrid({
         blocks,
         selected: ["k1", "deleted"],
         present: ["k1"],
      });
      const refreshSelection = vi.fn();
      const datasource = source({ getGridApi, refreshSelection });
      datasource.reload();
      await rowsFor(datasource, 0);
      expect(refreshSelection).not.toHaveBeenCalled();

      blocks[1] = { pageStatus: "loaded" };
      await rowsFor(datasource, 1);
      expect(refreshSelection).toHaveBeenCalledExactlyOnceWith(grid);
      expect(grid.setNodesSelected.mock.invocationCallOrder[0]).toBeLessThan(
         refreshSelection.mock.invocationCallOrder[0]!
      );

      await rowsFor(datasource, 0);
      expect(refreshSelection).toHaveBeenCalledOnce();
   });

   it("never prunes selection on a listing's first load", async () => {
      const { grid, getGridApi } = liveGrid({ selected: ["elsewhere"] });
      const refreshSelection = vi.fn();
      await rowsFor(source({ getGridApi, refreshSelection }), 0);
      expect(grid.getSelectedNodes).not.toHaveBeenCalled();
      expect(refreshSelection).not.toHaveBeenCalled();
   });

   it("shares a block the grid is already fetching with a later block's walk", async () => {
      const datasource = source();
      const [first, second] = await Promise.all([
         rowsFor(datasource, 0),
         rowsFor(datasource, 1),
      ]);
      expect(calls.map((c) => c.token)).toEqual([null, "1000"]);
      expect(first.rows[0]?.key).toBe("k0");
      expect(second.rows[0]?.key).toBe("k1000");
   });
});

describe("first block prefetch", () => {
   const scope = { serverId: "s", bucketName: "b", prefix: "" };

   it("hands its in-flight request to the datasource instead of fetching twice", async () => {
      const prefetch = prefetchFirstBlock(scope);
      prefetch.start();
      prefetch.start();
      expect(calls).toHaveLength(1);
      const onFirstPage = vi.fn();
      const datasource = source({ firstBlock: prefetch.take(), onFirstPage });

      const first = await rowsFor(datasource, 0);
      expect(calls).toHaveLength(1);
      expect(first.rows[0]?.key).toBe("k0");
      expect(onFirstPage).toHaveBeenCalledOnce();

      await rowsFor(datasource, 1);
      expect(calls.map((c) => c.token)).toEqual([null, "1000"]);
   });

   it("fetches the first block again when it is reloaded", async () => {
      const prefetch = prefetchFirstBlock(scope);
      prefetch.start();
      const datasource = source({ firstBlock: prefetch.take() });
      await rowsFor(datasource, 0);
      datasource.reload();
      await rowsFor(datasource, 0);
      expect(calls.map((c) => c.token)).toEqual([null, null]);
   });

   it("aborts an unclaimed request when cancelled", async () => {
      const blocked = blockedPage();
      const prefetch = prefetchFirstBlock(scope);
      prefetch.start();
      const signal = await blocked.signal;
      prefetch.cancel();
      expect(signal?.aborted).toBe(true);
      expect(prefetch.take()).toBeNull();
   });

   it("lets the datasource abort a claimed request", async () => {
      const blocked = blockedPage();
      const prefetch = prefetchFirstBlock(scope);
      prefetch.start();
      const signal = await blocked.signal;
      const datasource = source({ firstBlock: prefetch.take() });
      prefetch.cancel();
      expect(signal?.aborted).toBe(false);
      datasource.destroy();
      expect(signal?.aborted).toBe(true);
   });

   it("stays idle once a grid has claimed it first", () => {
      const prefetch = prefetchFirstBlock(scope);
      expect(prefetch.take()).toBeNull();
      prefetch.start();
      expect(get).not.toHaveBeenCalled();
   });
});
