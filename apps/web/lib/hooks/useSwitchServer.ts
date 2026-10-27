import { sameScope } from "@/lib/stores/session-scope";
import useSessionStore from "@/lib/stores/session-store";
import { toastFailure } from "@/lib/utils/toast";
import { SITE_PATHS } from "@s3-viewer/shared";
import { useRouter } from "next/router";
import { useCallback } from "react";

const useSwitchServer = () => {
   const router = useRouter();
   return useCallback(
      async (serverId: string) => {
         const previous = useSessionStore.getState();
         if (previous.serverId === serverId) return;
         try {
            const navigated = await router.push(SITE_PATHS.dashboard);
            const current = useSessionStore.getState();
            if (navigated && sameScope(current, previous))
               current.setServerId(serverId);
         } catch (error) {
            toastFailure(error);
         }
      },
      [router]
   );
};

export { useSwitchServer };
