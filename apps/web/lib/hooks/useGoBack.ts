import { hasInAppHistory } from "@/lib/navigation-guard";
import { isTypingTarget } from "@/lib/utils/dom";
import { SITE_PATHS } from "@s3-viewer/shared";
import { useRouter } from "next/router";
import { useCallback, useEffect } from "react";

const OVERLAY_SELECTOR =
   "[data-slot=dialog-content],[data-slot=select-content],[data-slot=dropdown-menu-content]";

// escape leaves the page too, unless an overlay or a field is there to take it
const useGoBack = () => {
   const router = useRouter();

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

   return goBack;
};

export { useGoBack };
