import { api, objectsPath, qs } from "@/lib/api";
import {
   MAX_LIST_BLOCK_SIZE,
   type S3Object,
   type S3ObjectListPage,
} from "@s3-viewer/types";
import type { GridApi, IDatasource, IGetRowsParams } from "ag-grid-community";

const MAX_EMPTY_PAGES_PER_BLOCK = 20;

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
   // fetches the first page, so a retry can be proven before the grid is shown
   prime: () => Promise<void>;
};

type Listing = {
   // tokens[i] resumes s3 at block i. a token is only recorded once block i is
   // full, so block i always starts at row i * MAX_LIST_BLOCK_SIZE.
   tokens: (string | undefined)[];
   end: number | null;
   chain: Promise<unknown>;
};

const freshListing = (): Listing => ({
   tokens: [undefined],
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
      let emptyPages = 0;
      for (;;) {
         const page = await fetchPage(token, MAX_LIST_BLOCK_SIZE - rows.length);
         rows.push(...page.objects);
         token = page.nextToken ?? undefined;
         if (!token || rows.length >= MAX_LIST_BLOCK_SIZE) break;
         if (page.objects.length > 0) emptyPages = 0;
         else if (++emptyPages >= MAX_EMPTY_PAGES_PER_BLOCK) {
            token = undefined;
            break;
         }
      }
      if (token) target.tokens[index + 1] = token;
      else target.end = index * MAX_LIST_BLOCK_SIZE + rows.length;
      return foldersFirst
         ? rows
              .filter((r) => r.isFolder)
              .concat(rows.filter((r) => !r.isFolder))
         : rows;
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
