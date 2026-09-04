import { hasPassword } from "@/lib/auth";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
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
