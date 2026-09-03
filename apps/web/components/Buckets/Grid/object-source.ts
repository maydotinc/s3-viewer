import { api, objectsPath, qs } from "@/lib/api";
import {
   MAX_LIST_BLOCK_SIZE,
   type S3Object,
   type S3ObjectListPage,
} from "@s3-viewer/types";
import type { GridApi, IDatasource, IGetRowsParams } from "ag-grid-community";

type ObjectSourceParams = {
   serverId: string;
   bucketName: string;
   prefix: string;
   getGridApi: () => GridApi | undefined;
   onError: (error: unknown) => void;
};

type ObjectDatasource = IDatasource & {
   reset: () => void;
   /** Starts over and fetches the first page, so a retry can be proven before the grid is shown again. */
   prime: () => Promise<void>;
};

type Listing = {
   rows: S3Object[];
   nextToken: string | null | undefined;
   chain: Promise<void>;
};

const freshListing = (): Listing => ({
   rows: [],
   nextToken: undefined,
   chain: Promise.resolve(),
});

const createObjectDatasource = ({
   serverId,
   bucketName,
   prefix,
   getGridApi,
   onError,
}: ObjectSourceParams): ObjectDatasource => {
   let listing = freshListing();

   const fetchNextPage = async (target: Listing) => {
      const page = await api.get<S3ObjectListPage>(
         `${objectsPath(serverId, bucketName)}${qs({
            prefix,
            continuationToken: target.nextToken,
            blockSize: MAX_LIST_BLOCK_SIZE,
         })}`
      );
      target.rows.push(...page.objects);
      target.nextToken = page.nextToken;
   };

   const ensureRows = (target: Listing, count: number): Promise<void> => {
      const run = target.chain.then(async () => {
         while (target.rows.length < count && target.nextToken !== null) {
            await fetchNextPage(target);
         }
      });
      target.chain = run.catch(() => undefined);
      return run;
   };

   const getRows = async (params: IGetRowsParams) => {
      const target = listing;
      try {
         await ensureRows(target, params.endRow);
         const rows = target.rows.slice(params.startRow, params.endRow);
         const lastRow =
            target.nextToken === null ? target.rows.length : undefined;
         params.successCallback(rows, lastRow);
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
         return ensureRows(listing, 1);
      },
   };
};

export { createObjectDatasource };
export type { ObjectDatasource };
