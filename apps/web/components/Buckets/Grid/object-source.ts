import { api, objectsPath, qs } from "@/lib/api";
import {
   MAX_LIST_BLOCK_SIZE,
   type S3Object,
   type S3ObjectListPage,
} from "@s3-viewer/types";
import type { GridApi, IDatasource, IGetRowsParams } from "ag-grid-community";

const MAX_EMPTY_PAGES_PER_BLOCK = 20;

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
});

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

   const readRows = async (
      target: Listing,
      index: number
   ): Promise<S3Object[]> => {
      const prefetched = index === 0 ? target.first : undefined;
      target.first = undefined;
      const { rows, token } = await (prefetched ??
         readBlock(scope, target.tokens[index], target.controller.signal));
      target.controller.signal.throwIfAborted();
      if (token) target.tokens[index + 1] = token;
      else target.end = index * MAX_LIST_BLOCK_SIZE + rows.length;
      if (index === 0) onFirstPage?.(rows.map((row) => row.key));
      return foldersFirst
         ? rows
              .filter((r) => r.isFolder)
              .concat(rows.filter((r) => !r.isFolder))
         : rows;
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

   const enqueue = (target: Listing, index: number): Promise<S3Object[]> => {
      if (index < target.tokens.length) return boundedFetch(target, index);
      const run = target.chain.then(() => loadBlock(target, index));
      target.chain = run.catch(() => undefined);
      return run;
   };

   const getRows = async (params: IGetRowsParams) => {
      const target = listing;
      try {
         target.controller.signal.throwIfAborted();
         const rows = await enqueue(
            target,
            Math.floor(params.startRow / MAX_LIST_BLOCK_SIZE)
         );
         target.controller.signal.throwIfAborted();
         params.successCallback(rows, target.end ?? undefined);
         if (target.controller.signal.aborted) return;
         const gridApi = getGridApi();
         if (!gridApi) return;
         if (params.startRow === 0) {
            if (rows.length === 0) gridApi.showNoRowsOverlay();
            else gridApi.hideOverlay();
         }
         if (target.reloaded && cacheSettled(gridApi)) {
            deselectVanished(gridApi);
            refreshSelection?.(gridApi);
            settleReload(target);
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
      reload: () => {
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
      },
   };
};

export { createObjectDatasource, prefetchFirstBlock };
