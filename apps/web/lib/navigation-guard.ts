import type { NextRouter } from "next/router";

const guards = new Set<() => boolean>();
const HISTORY_INDEX = "__viewerHistoryIndex";
const HISTORY_GROUP = "__viewerHistoryGroup";
const newHistoryGroup = () =>
   crypto.getRandomValues(new Uint32Array(4)).join("-");

const registerNavigationGuard = (guard: () => boolean): (() => void) => {
   guards.add(guard);
   return () => {
      guards.delete(guard);
   };
};

const confirmNavigation = (): boolean => [...guards].every((guard) => guard());

const historyIndex = (state: unknown): number | null => {
   if (!state || typeof state !== "object" || !(HISTORY_INDEX in state))
      return null;
   const index = state[HISTORY_INDEX];
   return typeof index === "number" && Number.isSafeInteger(index)
      ? index
      : null;
};

const hasInAppHistory = (): boolean =>
   (historyIndex(window.history.state) ?? 0) > 0;

const installNavigationGuard = (
   router: Pick<NextRouter, "push" | "replace" | "beforePopState">
): (() => void) => {
   const { history } = window;
   const pushState = history.pushState;
   const replaceState = history.replaceState;
   const push = router.push;
   const replace = router.replace;
   let currentIndex = historyIndex(history.state) ?? 0;
   let historyGroup: string =
      history.state?.[HISTORY_GROUP] ?? newHistoryGroup();
   let restoring = false;
   let restorationTimer: ReturnType<typeof setTimeout> | undefined;

   replaceState.call(
      history,
      {
         ...history.state,
         [HISTORY_INDEX]: currentIndex,
         [HISTORY_GROUP]: historyGroup,
      },
      ""
   );
   let currentEntry = { state: history.state, url: window.location.href };
   history.pushState = (data, unused, url) => {
      pushState.call(
         history,
         {
            ...data,
            [HISTORY_INDEX]: currentIndex + 1,
            [HISTORY_GROUP]: historyGroup,
         },
         unused,
         url
      );
      currentIndex++;
      currentEntry = { state: history.state, url: window.location.href };
   };
   history.replaceState = (data, unused, url) => {
      replaceState.call(
         history,
         {
            ...data,
            [HISTORY_INDEX]: currentIndex,
            [HISTORY_GROUP]: historyGroup,
         },
         unused,
         url
      );
      currentEntry = { state: history.state, url: window.location.href };
   };

   router.push = (...args) =>
      restoring || !confirmNavigation()
         ? Promise.resolve(false)
         : push.apply(router, args);
   router.replace = (...args) =>
      restoring || !confirmNavigation()
         ? Promise.resolve(false)
         : replace.apply(router, args);

   const restore = () => {
      clearTimeout(restorationTimer);
      restorationTimer = setTimeout(() => {
         const nextIndex =
            history.state?.[HISTORY_GROUP] === historyGroup
               ? historyIndex(history.state)
               : null;
         if (nextIndex === currentIndex) restoring = false;
         else if (nextIndex === null) {
            pushState.call(history, currentEntry.state, "", currentEntry.url);
            restoring = false;
         } else history.go(currentIndex - nextIndex);
      }, 0);
   };

   router.beforePopState((state) => {
      const nextIndex =
         history.state?.[HISTORY_GROUP] === historyGroup
            ? historyIndex(state)
            : null;
      if (restoring) {
         if (nextIndex === currentIndex) restoring = false;
         else restore();
         return false;
      }
      if (nextIndex === null) {
         if (!confirmNavigation()) {
            restoring = true;
            restore();
            return false;
         }
         historyGroup = newHistoryGroup();
         currentIndex = 0;
         history.replaceState(history.state, "");
         return true;
      }
      if (nextIndex !== currentIndex && !confirmNavigation()) {
         restoring = true;
         restore();
         return false;
      }
      currentIndex = nextIndex;
      currentEntry = { state: history.state, url: window.location.href };
      return true;
   });
   return () => {
      clearTimeout(restorationTimer);
      router.beforePopState(() => true);
      history.pushState = pushState;
      history.replaceState = replaceState;
      router.push = push;
      router.replace = replace;
   };
};

export { hasInAppHistory, installNavigationGuard, registerNavigationGuard };
