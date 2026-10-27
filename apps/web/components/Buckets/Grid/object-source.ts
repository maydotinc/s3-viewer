import { api, objectsPath, qs } from "@/lib/api";
import {
   MAX_LIST_BLOCK_SIZE,
   type S3Object,
   type S3ObjectListPage,
} from "@s3-viewer/shared";
import type { GridApi, IDatasource, IGetRowsParams } from "ag-grid-community";

const MAX_EMPTY_PAGES_PER_BLOCK = 20;
// raw blocks kept so re-sorting the grid's 10 cached pages rarely refetches. a sorted page's files can start
// any number of blocks back when folders crowd the blocks between, and a block outside this window is refetched.
const RECENT_BLOCKS = 24;

type ListingScope = {
   serverId: string;
   bucketName: string;
   prefix: string;
};

type Block = { rows: S3Object[]; token: string | undefined };

type PrefetchedBlock = {
   result: Promise<Block>;
   controller: AbortController;
};

type ObjectSourceParams = ListingScope & {
   foldersFirst: boolean;
   getGridApi: () => GridApi | undefined;
   onError: (error: unknown) => void;
   onFirstPage?: (keys: string[]) => void;
   onReloaded?: () => void;
   refreshSelection?: (gridApi: GridApi) => void;
   firstBlock?: PrefetchedBlock | null;
};

type ObjectDatasource = IDatasource & {
   destroy: () => void;
   reload: () => void;
};

type Listing = {
   // recorded only once block i is full, so block i starts at row i * MAX_LIST_BLOCK_SIZE.
   tokens: (string | undefined)[];
   end: number | null;
   chain: Promise<unknown>;
   controller: AbortController;
   first: Promise<Block> | undefined;
   inflight: Map<number, Promise<S3Object[]>>;
   reloaded: boolean;
   // folders first only: walked blocks' folders, file counts and last keys, and recent rows (least recently
   // used first) to re-slice without refetching.
   folders: S3Object[][];
   fileCounts: number[];
   lastKeys: (string | undefined)[];
   recent: Map<number, S3Object[]>;
   // folder count the grid's file rows were placed after; more found later means earlier pages are stale.
   sortedWith: number | null;
   // a re-sort found while a reload's blocks are still arriving, applied once they all have
   resortPending: boolean;
};

const freshListing = (
   prefetched: PrefetchedBlock | null = null,
   reloaded = false
): Listing => ({
   tokens: [undefined],
   end: null,
   chain: Promise.resolve(),
   controller: prefetched?.controller ?? new AbortController(),
   first: prefetched?.result,
   inflight: new Map(),
   reloaded,
   folders: [],
   fileCounts: [],
   lastKeys: [],
   recent: new Map(),
   sortedWith: null,
   resortPending: false,
});

const remember = (target: Listing, index: number, rows: S3Object[]) => {
   target.recent.delete(index);
   target.recent.set(index, rows);
   const oldest = target.recent.keys().next().value;
   if (target.recent.size > RECENT_BLOCKS && oldest !== undefined)
      target.recent.delete(oldest);
};

const recall = (target: Listing, index: number): S3Object[] | undefined => {
   const rows = target.recent.get(index);
   if (rows) remember(target, index, rows);
   return rows;
};

const readBlock = async (
   { serverId, bucketName, prefix }: ListingScope,
   continuationToken: string | undefined,
   signal: AbortSignal
): Promise<Block> => {
   const rows: S3Object[] = [];
   let token = continuationToken;
   let emptyPages = 0;
   for (;;) {
      signal.throwIfAborted();
      const page = await api.get<S3ObjectListPage>(
         `${objectsPath(serverId, bucketName)}${qs({
            prefix,
            continuationToken: token,
            blockSize: MAX_LIST_BLOCK_SIZE - rows.length,
         })}`,
         signal
      );
      signal.throwIfAborted();
      rows.push(...page.objects);
      token = page.nextToken ?? undefined;
      if (!token || rows.length >= MAX_LIST_BLOCK_SIZE) break;
      if (page.objects.length > 0) emptyPages = 0;
      else if (++emptyPages >= MAX_EMPTY_PAGES_PER_BLOCK) {
         token = undefined;
         break;
      }
   }
   return { rows, token };
};

// starts the first block before the grid chunk has loaded; the first datasource to take it owns its abort.
const prefetchFirstBlock = (scope: ListingScope) => {
   let pending: PrefetchedBlock | null = null;
   let taken = false;
   return {
      start: () => {
         if (taken || pending) return;
         const controller = new AbortController();
         const result = readBlock(scope, undefined, controller.signal);
         result.catch(() => undefined);
         pending = { result, controller };
      },
      cancel: () => {
         pending?.controller.abort();
         pending = null;
      },
      take: (): PrefetchedBlock | null => {
         taken = true;
         const prefetched = pending;
         pending = null;
         return prefetched;
      },
   };
};

const cacheSettled = (gridApi: GridApi): boolean =>
   Object.values(
      gridApi.getCacheBlockState() as Record<string, { pageStatus: string }>
   ).every((block) => block.pageStatus === "loaded");

// AG Grid keeps selected ids that vanished on refresh as detached nodes; only the reloaded cache can tell.
const deselectVanished = (gridApi: GridApi): void => {
   const present = new Set<string>();
   gridApi.forEachNode((node) => {
      if (node.id) present.add(node.id);
   });
   const vanished = gridApi
      .getSelectedNodes()
      .filter((node) => node.id && !present.has(node.id));
   if (vanished.length > 0)
      gridApi.setNodesSelected({ nodes: vanished, newValue: false });
};

const createObjectDatasource = ({
   serverId,
   bucketName,
   prefix,
   foldersFirst,
   getGridApi,
   onError,
   onFirstPage,
   onReloaded,
   refreshSelection,
   firstBlock,
}: ObjectSourceParams): ObjectDatasource => {
   const scope = { serverId, bucketName, prefix };
   let listing = freshListing(firstBlock);

   const settleReload = (target: Listing) => {
      if (!target.reloaded) return;
      target.reloaded = false;
      onReloaded?.();
   };

   const reload = () => {
      listing.controller.abort();
      listing = freshListing(null, true);
      const gridApi = getGridApi();
      if (!gridApi || gridApi.isDestroyed()) {
         settleReload(listing);
         return;
      }
      // the listing may have grown past the end the grid already found.
      if (gridApi.isLastRowIndexKnown())
         gridApi.setRowCount(gridApi.getInfiniteRowCount() ?? 0, false);
      // keeps current rows, page and selection on screen until the new blocks arrive.
      gridApi.refreshInfiniteCache();
   };

   const readRows = async (
      target: Listing,
      index: number
   ): Promise<S3Object[]> => {
      const prefetched = index === 0 ? target.first : undefined;
      target.first = undefined;
      const { rows, token } = await (prefetched ??
         readBlock(scope, target.tokens[index], target.controller.signal));
      target.controller.signal.throwIfAborted();
      const folders = foldersFirst ? rows.filter((row) => row.isFolder) : [];
      const lastKey = rows.at(-1)?.key;
      // a sorted listing's offsets rest on the walk, so a refetch that disagrees means the listing changed
      if (foldersFirst && index < target.fileCounts.length) {
         if (
            target.folders[index]?.length !== folders.length ||
            target.fileCounts[index] !== rows.length - folders.length ||
            target.lastKeys[index] !== lastKey
         ) {
            reload();
            target.controller.signal.throwIfAborted();
         }
         remember(target, index, rows);
         return rows;
      }
      if (token) target.tokens[index + 1] = token;
      else target.end = index * MAX_LIST_BLOCK_SIZE + rows.length;
      if (index === 0) onFirstPage?.(rows.map((row) => row.key));
      if (foldersFirst) {
         target.folders[index] = folders;
         target.fileCounts[index] = rows.length - folders.length;
         target.lastKeys[index] = lastKey;
         remember(target, index, rows);
      }
      return rows;
   };

   // a later block's walk can reach a block the grid is already fetching; share that request
   const fetchBlock = (target: Listing, index: number): Promise<S3Object[]> => {
      const inflight = target.inflight.get(index);
      if (inflight) return inflight;
      const run = readRows(target, index);
      target.inflight.set(index, run);
      const settle = () => target.inflight.delete(index);
      run.then(settle, settle);
      return run;
   };

   const boundedFetch = (
      target: Listing,
      index: number
   ): Promise<S3Object[]> =>
      target.end !== null && index * MAX_LIST_BLOCK_SIZE >= target.end
         ? Promise.resolve([])
         : fetchBlock(target, index);

   const loadBlock = async (
      target: Listing,
      index: number
   ): Promise<S3Object[]> => {
      for (let i = target.tokens.length - 1; i < index; i++) {
         if (target.end !== null) return [];
         await fetchBlock(target, i);
      }
      return boundedFetch(target, index);
   };

   const chained = <T>(target: Listing, step: () => Promise<T>): Promise<T> => {
      const run = target.chain.then(step);
      target.chain = run.catch(() => undefined);
      return run;
   };

   const enqueue = (target: Listing, index: number): Promise<S3Object[]> =>
      index < target.tokens.length
         ? boundedFetch(target, index)
         : chained(target, () => loadBlock(target, index));

   const walked = (target: Listing, index: number) =>
      index < target.fileCounts.length ||
      (target.end !== null && index * MAX_LIST_BLOCK_SIZE >= target.end);

   // the API interleaves folders and files by key, so every folder walked so far leads every file; files
   // keep listing order after them. a sorted block needs blocks 0..index walked, which hold all its files.
   const sortBlock = async (
      target: Listing,
      index: number
   ): Promise<{ rows: S3Object[]; stale: boolean }> => {
      if (!walked(target, index))
         await chained(target, async () => {
            for (let i = target.fileCounts.length; !walked(target, index); i++)
               await fetchBlock(target, i);
         });
      const folders = target.folders.flat();
      const start = index * MAX_LIST_BLOCK_SIZE;
      const stop = start + MAX_LIST_BLOCK_SIZE;
      const fileStart = Math.max(0, start - folders.length);
      const fileStop = stop - folders.length;
      // settled before the awaits below, so a slower block can't lower it and trigger a needless re-sort
      const stale =
         target.sortedWith !== null && folders.length > target.sortedWith;
      if (stale || fileStop > 0)
         target.sortedWith = Math.max(target.sortedWith ?? 0, folders.length);
      const spans: { block: number; from: number; to: number }[] = [];
      let offset = 0;
      for (const [block, count] of target.fileCounts.entries()) {
         if (offset >= fileStop) break;
         if (offset + count > fileStart)
            spans.push({
               block,
               from: Math.max(0, fileStart - offset),
               to: fileStop - offset,
            });
         offset += count;
      }
      const files = await Promise.all(
         spans.map(async ({ block, from, to }) =>
            (recall(target, block) ?? (await fetchBlock(target, block)))
               .filter((row) => !row.isFolder)
               .slice(from, to)
         )
      );
      return { rows: folders.slice(start, stop).concat(...files), stale };
   };

   const getRows = async (params: IGetRowsParams) => {
      const target = listing;
      try {
         target.controller.signal.throwIfAborted();
         const index = Math.floor(params.startRow / MAX_LIST_BLOCK_SIZE);
         const { rows, stale } = foldersFirst
            ? await sortBlock(target, index)
            : { rows: await enqueue(target, index), stale: false };
         target.controller.signal.throwIfAborted();
         const gridApi = getGridApi();
         // re-places files on pages already shown before this one lands, so no key shows on two pages. a reload
         // re-requests its pages in order and each could re-sort the rest, so it re-sorts once at the end instead
         if (stale && target.reloaded) target.resortPending = true;
         else if (stale) gridApi?.refreshInfiniteCache();
         params.successCallback(rows, target.end ?? undefined);
         if (target.controller.signal.aborted || !gridApi) return;
         if (params.startRow === 0) {
            if (rows.length === 0) gridApi.showNoRowsOverlay();
            else gridApi.hideOverlay();
         }
         if (target.reloaded && cacheSettled(gridApi)) {
            deselectVanished(gridApi);
            refreshSelection?.(gridApi);
            settleReload(target);
            if (target.resortPending) {
               target.resortPending = false;
               gridApi.refreshInfiniteCache();
            }
         }
      } catch (error) {
         // AG Grid frees its loader slot only through this callback, even for destroyed blocks.
         params.failCallback();
         if (target.controller.signal.aborted) return;
         onError(error);
         settleReload(target);
      }
   };

   return {
      getRows,
      destroy: () => {
         listing.controller.abort();
         settleReload(listing);
      },
      reload,
   };
};

export { createObjectDatasource, prefetchFirstBlock };
