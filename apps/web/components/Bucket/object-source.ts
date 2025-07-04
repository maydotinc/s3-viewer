import { queryClient } from "@/lib/queryClient";
import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { S3Object } from "@s3-viewer/types";
import { IDatasource, IGetRowsParams } from "ag-grid-community";

type PageMeta = {
   nextToken: string | null;
};

const MakeObjectSource = (
   bucket: string,
   blockSize: number,
   serverId: string
): IDatasource => {
   const pageCache: Record<number, PageMeta> = {};

   const getRows = async (params: IGetRowsParams) => {
      const page = Math.floor(params.startRow / blockSize);
      const continuationToken = pageCache[page - 1]?.nextToken;

      const searchParams = new URLSearchParams({
         serverId,
         bucket,
         blockSize: blockSize.toString(),
         ...(continuationToken && { continuationToken }),
      });

      try {
         const response = await queryClient.fetchQuery({
            queryKey: ["objects", serverId, bucket, page],
            queryFn: async ({ signal }) => {
               const response = await createApiRequest(
                  `/s3/object/list?${searchParams.toString()}`,
                  { signal }
               );

               if (!response.ok) {
                  await handleApiError(response);
               }

               const { objects, nextToken } = (await response.json()) as {
                  objects: S3Object[];
                  nextToken: string | null;
               };
               return { objects, nextToken };
            },
         });

         pageCache[page] = {
            nextToken: response.nextToken,
         };

         const lastRow = response.nextToken
            ? undefined
            : page * blockSize + (response.objects?.length || 0);

         params.successCallback(response.objects, lastRow);
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
