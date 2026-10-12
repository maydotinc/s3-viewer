import {
   ApiError,
   ClientErrorCode,
   api,
   objectMutationPath,
   qs,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { isScoped, useSessionScope } from "@/lib/stores/session-scope";
import { useQuery } from "@tanstack/react-query";

type ObjectContent = { text: string; eTag: string | null };

const NOT_TEXT_MESSAGE =
   "This file isn't UTF-8 text, so it can't be edited here.";

const decodeUtf8 = (body: ArrayBuffer): string => {
   try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
         body
      );
   } catch {
      throw new ApiError(415, NOT_TEXT_MESSAGE, ClientErrorCode.NOT_UTF8);
   }
};

const readObjectContent = async (
   serverId: string,
   bucketName: string,
   objectKey: string,
   signal?: AbortSignal
): Promise<ObjectContent> => {
   const { body, headers } = await api.bytes(
      `${objectMutationPath(serverId, bucketName, "/content")}${qs({ objectKey })}`,
      signal
   );
   return { text: decodeUtf8(body), eTag: headers.get("ETag") };
};

const useObjectContent = (
   bucketName: string,
   objectKey: string,
   enabled: boolean
) => {
   const { userId, serverId } = useSessionScope();

   return useQuery({
      queryKey: queryKeys.objectContent(
         userId,
         serverId,
         bucketName,
         objectKey
      ),
      queryFn: ({ signal }) =>
         readObjectContent(serverId, bucketName, objectKey, signal),
      enabled: enabled && isScoped(userId, serverId, bucketName, objectKey),
      gcTime: 0,
      retry: false,
   });
};

export default useObjectContent;
export { readObjectContent };
export type { ObjectContent };
