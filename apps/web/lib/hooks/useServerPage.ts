import useServerInfo from "@/lib/hooks/queries/server/useServerInfo";
import { hasInAppHistory } from "@/lib/navigation-guard";
import { useServerId } from "@/lib/stores/session-scope";
import useSessionStore from "@/lib/stores/session-store";
import { isTypingTarget } from "@/lib/utils/dom";
import { SITE_PATHS, type ServerInfo } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef } from "react";

const OVERLAY_SELECTOR =
   "[data-slot=dialog-content],[data-slot=select-content],[data-slot=dropdown-menu-content]";

type ServerPageOptions = {
   serverId: string;
   canOpen: (server: ServerInfo) => boolean;
   pathFor: (serverId: string) => string;
};

const useServerPage = ({ serverId, canOpen, pathFor }: ServerPageOptions) => {
   const router = useRouter();
   const sessionServerId = useServerId();
   const { data: server = null, isLoading } = useServerInfo(serverId);
   const {
      data: selectedServer,
      isLoading: isSelectedLoading,
      error: selectedError,
   } = useServerInfo(sessionServerId);
   const setServerId = useSessionStore((state) => state.setServerId);
   const adoptedRef = useRef<string | null>(null);

   const allowed = server ? canOpen(server) : false;

   const goBack = useCallback(() => {
      if (hasInAppHistory()) router.back();
      else void router.push(SITE_PATHS.dashboard);
   }, [router]);

   useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key !== "Escape" || event.defaultPrevented) return;
         if (isTypingTarget(event.target)) return;
         if (document.querySelector(OVERLAY_SELECTOR)) return;
         goBack();
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
   }, [goBack]);

   useEffect(() => {
      if (!server || !allowed || sessionServerId === serverId) return;
      if (adoptedRef.current !== serverId) {
         adoptedRef.current = serverId;
         setServerId(serverId);
         return;
      }
      if (!sessionServerId || isSelectedLoading || selectedError) return;
      void router.replace(
         selectedServer && canOpen(selectedServer)
            ? pathFor(sessionServerId)
            : SITE_PATHS.dashboard
      );
   }, [
      allowed,
      canOpen,
      pathFor,
      router,
      server,
      serverId,
      selectedServer,
      isSelectedLoading,
      selectedError,
      sessionServerId,
      setServerId,
   ]);

   return {
      server,
      allowed,
      isLoading,
      goBack,
      bucketsAdopted: sessionServerId === serverId,
   };
};

export { useServerPage };
