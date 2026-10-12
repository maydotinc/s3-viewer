import { hasPassword } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import { useQuery } from "@tanstack/react-query";

const useHasPassword = () => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.hasPassword(userId),
      queryFn: hasPassword,
      enabled: Boolean(userId),
   });
};

export { useHasPassword };
