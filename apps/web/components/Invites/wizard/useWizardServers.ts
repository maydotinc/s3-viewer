import useServers from "@/lib/hooks/queries/server/useServers";
import { membersPath } from "@/lib/server-paths";
import { SITE_PATHS } from "@s3-viewer/shared";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, type Dispatch } from "react";
import { manageableServers } from "../manageable";
import type { WizardAction, WizardState } from "./wizard-state";
import { wizardSteps } from "./wizard-text";

// the servers the user can invite to, and the selection the URL or a lone server makes for them
const useWizardServers = (
   { step, selected }: Pick<WizardState, "step" | "selected">,
   dispatch: Dispatch<WizardAction>
) => {
   const router = useRouter();
   const {
      servers,
      isSessionPending,
      isServerListLoading,
      hasNextPage,
      serverListError,
      isFetching,
      isFetchNextPageError,
      fetchNextPage,
      refetch,
   } = useServers();

   const manageable = useMemo(() => manageableServers(servers), [servers]);
   const listLoading = isSessionPending || isServerListLoading;
   const stepsKnown = Boolean(serverListError) || !listLoading;
   const only =
      stepsKnown && manageable.length === 1 && !hasNextPage && !serverListError
         ? manageable[0]
         : undefined;
   const hasWhere = only === undefined;
   const steps = useMemo(() => wizardSteps(hasWhere), [hasWhere]);

   // the list can resolve to a single server while the user is already on Where
   useEffect(() => {
      if (!hasWhere && step === "where")
         dispatch({ type: "goTo", step: "access" });
   }, [dispatch, hasWhere, step]);

   const preselected = useRef(false);
   const wanted = router.query.server;
   // leaving returns to the server the user came from, when they came from one
   const backHref =
      typeof wanted === "string"
         ? membersPath(wanted)
         : SITE_PATHS.settingsMembers;
   useEffect(() => {
      if (preselected.current || !router.isReady) return;
      if (typeof wanted !== "string") {
         preselected.current = true;
         return;
      }
      if (!manageable.some(({ id }) => id === wanted)) return;
      preselected.current = true;
      dispatch({ type: "server", serverId: wanted, checked: true });
   }, [dispatch, router.isReady, wanted, manageable]);

   // the single manageable server is selected for the user, so a list that later grows keeps it
   useEffect(() => {
      if (only && !selected.includes(only.id))
         dispatch({ type: "servers", serverIds: [only.id] });
   }, [dispatch, only, selected]);

   return {
      manageable,
      listLoading,
      stepsKnown,
      only,
      steps,
      backHref,
      pages: {
         hasNextPage,
         isFetching,
         error: serverListError,
         isFetchNextPageError,
         fetchNextPage,
         refetch,
      },
   };
};

export default useWizardServers;
