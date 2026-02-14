import { createApiRequest } from "@/lib/utils/api";
import { S3Object } from "@s3-viewer/types";
import { IDatasource, IGetRowsParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

type PageMeta = {
   nextToken: string | undefined;
};

const MakeObjectSource = (
   gridRef: React.RefObject<AgGridReact | null>,
   bucket: string,
   path: string[],
   blockSize: number,
   serverId: string,
   onFatalError?: (message: string) => void
): IDatasource => {
   if (!bucket) return { getRows: () => { } };

   const pageCache: Record<number, PageMeta> = {};
   let halted = false;

   const getRows = async (params: IGetRowsParams) => {
      if (halted) {
         params.failCallback();
         return;
      }

      const page = Math.floor(params.startRow / blockSize);
      const continuationToken = pageCache[page - 1]?.nextToken;
      const filter = params.filterModel?.Key?.filter ?? "";
      const prefix = path.length > 0 ? path.join("/") + "/" + filter : filter;

      const searchParams = new URLSearchParams({
         serverId,
         bucket,
         blockSize: blockSize.toString(),
         ...(continuationToken && { continuationToken }),
         ...(prefix && { prefix }),
      });

      try {
         const response = await createApiRequest(
            `/s3/object/list?${searchParams.toString()}`
         );
         if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const msg = body.error ?? body.message ?? `Request failed (${response.status})`;
            if (response.status === 500 || response.status === 403) {
               halted = true;
               onFatalError?.(msg);
               params.failCallback();
               return;
            }
            throw new Error(msg);
         }
         const { objects, nextToken } = (await response.json()) as {
            objects: S3Object[];
            nextToken: string | undefined;
         };
         pageCache[page] = {
            nextToken: nextToken,
         };

         const lastRow = nextToken
            ? undefined
            : page * blockSize + (objects?.length || 0);

         if (objects.length === 0) {
            gridRef.current?.api?.showNoRowsOverlay();
         } else {
            gridRef.current?.api?.hideOverlay();
         }

         params.successCallback(objects, lastRow);
      } catch (error: any) {
         console.error("Error fetching objects", error.message);
         params.failCallback();
      }
   };

   return {
      getRows,
   };
};

export default MakeObjectSource;
