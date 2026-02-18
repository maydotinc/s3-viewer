import { createApiRequest } from "@/lib/utils/api";
import { useQuery } from "@tanstack/react-query"

type UseObjectsProps = {
  serverId: string;
  bucketName: string;
  prefix: string;
  partial: string;
};

const useObjects = ({ serverId, bucketName, prefix, partial }: UseObjectsProps) => {
  const { data: keys = [] } = useQuery<string[]>({
    queryKey: ["path-suggestions", serverId, bucketName, prefix],
    queryFn: async () => {
      const params = new URLSearchParams({
        serverId,
        bucket: bucketName,
        blockSize: "100",
        ...(prefix && { prefix }),
      });
      const response = await createApiRequest(
        `/s3/object/list?${params.toString()}`
      );
      if (!response.ok) return [];
      const data = await response.json();
      return (data.objects || []).map((o: { Key: string }) => o.Key);
    },
    enabled: !!serverId && !!bucketName && !!partial,
    staleTime: 30_000,
  });

  return keys;
};

export default useObjects;