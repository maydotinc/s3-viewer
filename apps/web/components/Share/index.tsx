import { Page, PageHeader } from "@/components/Layout/page";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import { INVITE_TTL_DAYS, SITE_PATHS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { ChevronLeft, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef } from "react";
import InviteForm from "./invite-form";
import Members from "./members";
import PendingInvites from "./pending-invites";

const sharePath = (serverId: string) => `/servers/${serverId}/share`;

const OVERLAY_SELECTOR =
   "[data-slot=dialog-content],[data-slot=select-content],[data-slot=dropdown-menu-content]";

const isTypingTarget = (target: EventTarget | null): boolean =>
   target instanceof HTMLElement &&
   (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const ErrorState = ({ message }: { message: string }) => (
   <div className="flex min-w-0 shrink-0 flex-col items-center gap-3 rounded-xl border border-viewerborder bg-viewerwhite px-6 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-viewergray">
         <ShieldOff
            aria-hidden="true"
            className="size-5 text-viewerlighttext"
         />
      </span>
      <p className="text-sm text-viewertext">{message}</p>
      <Button asChild variant="outline">
         <Link href={SITE_PATHS.dashboard}>Back to dashboard</Link>
      </Button>
   </div>
);

const Share = ({ serverId }: { serverId: string }) => {
   const router = useRouter();
   const { servers, isLoading } = useServers();
   const { buckets, isBucketsLoading } = useBuckets();
   const sessionServerId = useSessionStore((state) => state.serverId);
   const setServerId = useSessionStore((state) => state.setServerId);
   const adoptedRef = useRef<string | null>(null);

   const server = servers.find((s) => s.id === serverId) ?? null;
   const canManage = hasPermission(
      server?.userRole ?? null,
      Permission.MANAGE_MEMBERS
   );

   const goBack = useCallback(() => {
      if (window.history.length > 1) router.back();
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

   // Buckets and the sidebar follow the selected server, so the route decides
   // it on arrival — and the page follows the sidebar afterwards. A server the
   // user cannot manage is never adopted, and never becomes this page.
   useEffect(() => {
      if (!server || !canManage || sessionServerId === serverId) return;
      if (adoptedRef.current !== serverId) {
         adoptedRef.current = serverId;
         setServerId(serverId);
         return;
      }
      if (!sessionServerId) return;
      const next = servers.find((s) => s.id === sessionServerId) ?? null;
      const canManageNext = hasPermission(
         next?.userRole ?? null,
         Permission.MANAGE_MEMBERS
      );
      void router.replace(
         canManageNext ? sharePath(sessionServerId) : SITE_PATHS.dashboard
      );
   }, [
      canManage,
      router,
      server,
      serverId,
      servers,
      sessionServerId,
      setServerId,
   ]);

   if (isLoading || !serverId)
      return (
         <Page className="items-center justify-center">
            <Spinner label="Loading server" />
         </Page>
      );

   if (!server || !canManage)
      return (
         <Page>
            <ErrorState
               message={
                  server
                     ? "You need admin access to invite people to this server."
                     : "This server doesn't exist, or you're not a member of it."
               }
            />
         </Page>
      );

   return (
      <Page>
         <PageHeader>
            <div className="flex min-w-0 items-start gap-3">
               <SimpleTooltip label="Back" shortcut="Esc">
                  <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     aria-label="Back"
                     className="shrink-0"
                     onClick={goBack}
                  >
                     <ChevronLeft aria-hidden="true" />
                  </Button>
               </SimpleTooltip>
               <div className="flex min-w-0 flex-col gap-1">
                  <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-viewerblack">
                     Share {server.name}
                  </h1>
                  <p className="text-sm text-viewertext">
                     Invites expire after {INVITE_TTL_DAYS} days. Members only
                     see the buckets you grant.
                  </p>
               </div>
            </div>
         </PageHeader>
         <InviteForm
            serverId={server.id}
            myRole={server.userRole}
            buckets={buckets}
            isBucketsLoading={isBucketsLoading}
         />
         <Members
            serverId={server.id}
            myRole={server.userRole}
            buckets={buckets}
            isBucketsLoading={isBucketsLoading}
         />
         <PendingInvites serverId={server.id} />
      </Page>
   );
};

export default Share;
export { sharePath };
