import { registerNavigationGuard } from "@/lib/navigation-guard";
import { useBeforeUnload } from "./useBeforeUnload";
import { useEffect } from "react";

const useUnsavedChangesGuard = (
   dirty: boolean,
   message: string,
   isCurrent: () => boolean
): void => {
   useBeforeUnload(dirty && isCurrent());
   useEffect(() => {
      if (!dirty) return;
      return registerNavigationGuard(
         () => !isCurrent() || window.confirm(message)
      );
   }, [dirty, message, isCurrent]);
};

export { useUnsavedChangesGuard };
