import { Page, PageHeader } from "@/components/Layout/page";
import useBuckets, { NO_BUCKETS } from "@/lib/hooks/queries/s3/useBuckets";
import { useSentInvites } from "@/lib/hooks/queries/server/useInvites";
import useMembers from "@/lib/hooks/queries/server/useMembers";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import { Role, S3Bucket, SITE_PATHS, ServerInvite } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { TabButton, TabList } from "@s3-viewer/ui/components/tabs";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { ChevronLeft, ShieldOff, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import InviteDialog from "./invite-dialog";
import Members from "./members";
import PendingInvites from "./pending-invites";
import { TableError } from "./table-states";

const sharePath = (serverId: string) => `/servers/${serverId}/share`;

const OVERLAY_SELECTOR =
   "[data-slot=dialog-content],[data-slot=select-content],[data-slot=dropdown-menu-content]";

const NO_INVITES: ServerInvite[] = [];

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

type Tab = "members" | "invites";

type ShareTabsProps = {
   serverId: string;
   myRole: Role;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
};

const ShareTabs = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
}: ShareTabsProps) => {
   const [tab, setTab] = useState<Tab>("members");
   const members = useMembers(serverId);
   const invites = useSentInvites(serverId);
   const inviteList = invites.data ?? NO_INVITES;
   const memberCount =
      members.isLoading || members.error ? undefined : members.members.length;
   const inviteCount =
      invites.isLoading || invites.error ? undefined : inviteList.length;

   return (
      <div className="flex min-w-0 shrink-0 flex-col gap-4">
         <TabList role="tablist">
            <TabButton
               id="share-tab-members"
               aria-controls="share-tabpanel"
               active={tab === "members"}
               count={memberCount}
               onClick={() => setTab("members")}
            >
               Members
            </TabButton>
            <TabButton
               id="share-tab-invites"
               aria-controls="share-tabpanel"
               active={tab === "invites"}
               count={inviteCount}
               onClick={() => setTab("invites")}
            >
               Pending invites
            </TabButton>
         </TabList>
         <section
            id="share-tabpanel"
            role="tabpanel"
            aria-labelledby={`share-tab-${tab}`}
            className="min-w-0 overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite"
         >
            {tab === "members" ? (
               members.error ? (
                  <TableError>{members.error.message}</TableError>
               ) : (
                  <Members
                     serverId={serverId}
                     myRole={myRole}
                     buckets={buckets}
                     isBucketsLoading={isBucketsLoading}
                     members={members.members}
                     isLoading={members.isLoading}
                  />
               )
            ) : invites.error ? (
               <TableError>{invites.error.message}</TableError>
            ) : (
               <PendingInvites
                  serverId={serverId}
                  invites={inviteList}
                  isLoading={invites.isLoading}
               />
            )}
         </section>
      </div>
   );
};

const Share = ({ serverId }: { serverId: string }) => {
   const router = useRouter();
   const { servers, isLoading } = useServers();
   const { buckets, isBucketsLoading } = useBuckets();
   const sessionServerId = useSessionStore((state) => state.serverId);
   const setServerId = useSessionStore((state) => state.setServerId);
   const adoptedRef = useRef<string | null>(null);
   const [inviting, setInviting] = useState(false);

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

   // buckets and the sidebar follow the selected server, so the route decides
   // it on arrival and the page follows the sidebar afterwards.
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

   // useBuckets reads the session server, so its buckets belong to this page
   // only once the adopt effect above has landed.
   const bucketsAdopted = sessionServerId === serverId;

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

   const bucketProps = {
      buckets: bucketsAdopted ? buckets : NO_BUCKETS,
      isBucketsLoading: !bucketsAdopted || isBucketsLoading,
   };

   return (
      <Page>
         <PageHeader
            actions={
               <Button type="button" onClick={() => setInviting(true)}>
                  <UserRoundPlus aria-hidden="true" />
                  Invite people
               </Button>
            }
         >
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
                     Invite people and choose which buckets they can see.
                  </p>
               </div>
            </div>
         </PageHeader>
         {inviting && (
            <InviteDialog
               serverId={server.id}
               myRole={server.userRole}
               onClose={() => setInviting(false)}
               {...bucketProps}
            />
         )}
         <ShareTabs
            serverId={server.id}
            myRole={server.userRole}
            {...bucketProps}
         />
      </Page>
   );
};

export default Share;
export { sharePath };
