import { api, objectsPath, qs } from "@/lib/api";
import {
   MAX_LIST_BLOCK_SIZE,
   type S3Object,
   type S3ObjectListPage,
} from "@s3-viewer/types";
import type { GridApi, IDatasource, IGetRowsParams } from "ag-grid-community";

const MAX_CACHED_BLOCKS = 10;
const MAX_CALLS_PER_BLOCK = 20;

type ObjectSourceParams = {
   serverId: string;
   bucketName: string;
   prefix: string;
   foldersFirst: boolean;
   getGridApi: () => GridApi | undefined;
   onError: (error: unknown) => void;
};

type ObjectDatasource = IDatasource & {
   reset: () => void;
   /** Starts over and fetches the first page, so a retry can be proven before the grid is shown again. */
   prime: () => Promise<void>;
};

type Listing = {
   /** tokens[i] resumes S3 at block i; the array only ever grows by one known token at a time. */
   tokens: (string | undefined)[];
   blocks: Map<number, S3Object[]>;
   end: number | null;
   chain: Promise<unknown>;
};

const freshListing = (): Listing => ({
   tokens: [undefined],
   blocks: new Map(),
   end: null,
   chain: Promise.resolve(),
});

const createObjectDatasource = ({
   serverId,
   bucketName,
   prefix,
   foldersFirst,
   getGridApi,
   onError,
}: ObjectSourceParams): ObjectDatasource => {
   let listing = freshListing();

   const fetchPage = (
      continuationToken: string | undefined,
      blockSize: number
   ) =>
      api.get<S3ObjectListPage>(
         `${objectsPath(serverId, bucketName)}${qs({
            prefix,
            continuationToken,
            blockSize,
         })}`
      );

   const fetchBlock = async (
      target: Listing,
      index: number
   ): Promise<S3Object[]> => {
      const rows: S3Object[] = [];
      let token = target.tokens[index];
      for (let calls = 0; calls < MAX_CALLS_PER_BLOCK; calls++) {
         const page = await fetchPage(token, MAX_LIST_BLOCK_SIZE - rows.length);
         rows.push(...page.objects);
         token = page.nextToken ?? undefined;
         if (!token || rows.length >= MAX_LIST_BLOCK_SIZE) break;
      }
      if (token) target.tokens[index + 1] = token;
      else target.end = index * MAX_LIST_BLOCK_SIZE + rows.length;
      const block = foldersFirst
         ? rows
              .filter((r) => r.isFolder)
              .concat(rows.filter((r) => !r.isFolder))
         : rows;
      target.blocks.set(index, block);
      if (target.blocks.size > MAX_CACHED_BLOCKS) {
         const oldest = target.blocks.keys().next().value;
         if (oldest !== undefined) target.blocks.delete(oldest);
      }
      return block;
   };

   const loadBlock = async (
      target: Listing,
      index: number
   ): Promise<S3Object[]> => {
      for (let i = target.tokens.length - 1; i < index; i++) {
         if (target.end !== null) return [];
         await fetchBlock(target, i);
      }
      if (target.end !== null && index * MAX_LIST_BLOCK_SIZE >= target.end)
         return [];
      return fetchBlock(target, index);
   };

   const enqueue = (target: Listing, index: number): Promise<S3Object[]> => {
      const cached = target.blocks.get(index);
      if (cached) {
         target.blocks.delete(index);
         target.blocks.set(index, cached);
         return Promise.resolve(cached);
      }
      const run = target.chain.then(() => loadBlock(target, index));
      target.chain = run.catch(() => undefined);
      return run;
   };

   const getRows = async (params: IGetRowsParams) => {
      const target = listing;
      try {
         const rows = await enqueue(
            target,
            Math.floor(params.startRow / MAX_LIST_BLOCK_SIZE)
         );
         params.successCallback(rows, target.end ?? undefined);
         if (params.startRow === 0) {
            const gridApi = getGridApi();
            if (rows.length === 0) gridApi?.showNoRowsOverlay();
            else gridApi?.hideOverlay();
         }
      } catch (error) {
         params.failCallback();
         onError(error);
      }
   };

   return {
      getRows,
      reset: () => {
         listing = freshListing();
      },
      prime: () => {
         listing = freshListing();
         return enqueue(listing, 0).then(() => undefined);
      },
   };
};

export { createObjectDatasource };
export type { ObjectDatasource };
