import { api, field, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { useSwitchServer } from "@/lib/hooks/useSwitchServer";
import { sameScope } from "@/lib/stores/session-scope";
import useSessionStore from "@/lib/stores/session-store";
import { CreateServerInput, ServerInfo } from "@s3-viewer/shared";
import { toast } from "@s3-viewer/ui/components/toast";

const useCreateServer = () => {
   const switchServer = useSwitchServer();

   return useApiMutation<ServerInfo, ApiError, CreateServerInput>({
      request: (body) =>
         api
            .post<{ server: ServerInfo }>("/servers", body)
            .then(field("server")),
      refreshes: ({ scope }) => [queryKeys.servers(scope.userId)],
      success: async ({ data, scope }) => {
         if (!sameScope(useSessionStore.getState(), scope)) return;
         await switchServer(data.id);
         if (useSessionStore.getState().userId === scope.userId)
            toast.success("Server connected");
      },
   });
};

export default useCreateServer;
