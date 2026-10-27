import { Wordmark } from "@/components/wordmark";
import { KEY_CLASS } from "@s3-viewer/ui/components/kbd";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ChevronDown,
   ChevronLeft,
   ChevronRight,
   Ellipsis,
   Folder,
   PanelLeft,
   Plus,
   RefreshCw,
   Search,
   UserIcon,
   UserRoundPlus,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { ScaledFrame } from "./frame";
import type { ProviderId } from "@/lib/provider-paths";
import { ProviderMark } from "./provider-marks";
import {
   HOVER_FILL,
   Layers,
   PRIMARY_SERVER,
   SERVERS,
   ServerSwitcher,
} from "./server-switcher";

const CREATED: Record<string, string> = {
   barberflow: "Jul 8, 2025, 9:12 AM",
   "s3-viewer": "Jan 2, 2026, 4:40 PM",
   pastsmalltalk: "Oct 21, 2025, 11:05 AM",
   crayo: "Feb 5, 2026, 2:18 PM",
   "nightly-db": "Mar 11, 2026, 3:00 AM",
   "media-archive": "Dec 2, 2025, 10:27 AM",
   logs: "Aug 19, 2026, 6:51 PM",
   snapshots: "Jun 30, 2026, 1:09 AM",
   "may-site": "May 14, 2025, 8:33 AM",
   "email-assets": "Sep 3, 2025, 12:46 PM",
   "pg-wal": "Nov 27, 2025, 5:14 AM",
   "audit-trail": "Feb 18, 2026, 7:22 PM",
};

// the sidebar keeps the four buckets every figure shares; the wide table adds
// these so the taller laptop frame fills with rows instead of blank space
const WIDE_EXTRA: Record<string, string[]> = {
   may: ["may-site", "email-assets"],
   backup: ["pg-wal", "audit-trail"],
};

const PROVIDER_NAME: Record<ProviderId, string> = {
   cloudflare: "Cloudflare R2",
   aws: "Amazon S3",
};

const WIDE_ONLY = "@max-lg/frame:hidden";

// mirrors the dashboard's outline and primary buttons
const OUTLINE = cn(
   "inline-flex h-9 items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-4 text-sm font-medium whitespace-nowrap text-viewertext hover:text-viewerblack",
   HOVER_FILL
);

const PRIMARY =
   "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-viewerblue px-4 text-sm font-medium whitespace-nowrap text-viewerwhite transition-colors duration-150 hover:bg-viewerdarkblue motion-reduce:transition-none";

const CHIP =
   "flex h-9 items-center justify-center gap-2 rounded-lg border border-viewerborder px-3 text-sm text-viewerblack";

const Key = ({ children }: { children: ReactNode }) => (
   <kbd className={KEY_CLASS}>{children}</kbd>
);

const NAME_COL = "min-w-0 flex-1 px-4";
const CREATED_COL = cn("w-50 shrink-0 px-4 text-right", WIDE_ONLY);
const ROLE_COL = cn("w-30 shrink-0 px-4", WIDE_ONLY);
const ACTIONS_COL = "grid w-16 shrink-0 place-items-center";

export const AppHeroFigure = () => {
   const [currentId, setCurrentId] = useState(PRIMARY_SERVER.id);
   const current = SERVERS.find((server) => server.id === currentId);
   if (!current) return null;

   return (
      <ScaledFrame
         width={1024}
         height={608}
         narrow={{ width: 400, height: 568 }}
         label="S3 Viewer dashboard: sidebar with the server switcher open and the buckets table for May Inc."
      >
         <div className="flex size-full cursor-default flex-col bg-viewerwhite text-sm text-viewertext">
            <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-viewerborder bg-viewerwhite px-6 @max-lg/frame:px-3">
               <div className="flex items-center gap-3">
                  <Wordmark
                     alt=""
                     priority
                     className="h-8 w-auto shrink-0 @max-lg/frame:h-auto @max-lg/frame:w-28"
                  />
                  <span className="grid size-9 place-items-center rounded-lg text-viewertext">
                     <PanelLeft className="size-4" />
                  </span>
               </div>
               <div className="flex items-center gap-3">
                  <div
                     className={cn(
                        "flex h-9 w-64 items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-viewerlighttext",
                        WIDE_ONLY
                     )}
                  >
                     <Search className="size-4 shrink-0" />
                     <span className="flex-1">Search</span>
                     <span className="flex gap-0.5">
                        <Key>⌘</Key>
                        <Key>K</Key>
                     </span>
                  </div>
                  <span className="hidden size-8 place-items-center text-viewertext @max-lg/frame:grid">
                     <Search className="size-4" />
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-135 from-[hsl(214_72%_58%)] to-[hsl(262_68%_42%)] text-[13px] font-semibold text-viewerwhite">
                     M
                  </span>
               </div>
            </div>

            <div className="flex min-h-0 flex-1">
               <div
                  className={cn(
                     "w-64 shrink-0 border-r border-viewerborder bg-viewerwhite px-4 py-5",
                     WIDE_ONLY
                  )}
               >
                  <p className="mb-2 text-[11px] font-medium tracking-wide text-viewerlighttext uppercase">
                     Servers
                  </p>
                  <ServerSwitcher
                     servers={SERVERS}
                     currentId={current.id}
                     onSelect={setCurrentId}
                  />
               </div>

               <div className="flex min-w-0 flex-1 flex-col gap-6 px-8 py-6 @max-lg/frame:gap-4 @max-lg/frame:px-4 @max-lg/frame:py-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 @max-lg/frame:gap-3">
                     <p className="text-xl font-semibold tracking-tight text-viewerblack @max-lg/frame:basis-full">
                        Buckets
                     </p>
                     <div className="flex gap-2">
                        <div className={cn(CHIP, "w-44")}>
                           <span className="grid size-6 shrink-0 place-items-center">
                              <ProviderMark provider={current.provider} />
                           </span>
                           {PROVIDER_NAME[current.provider]}
                        </div>
                        <div className={cn(CHIP, "w-28")}>
                           <UserIcon className="size-4 shrink-0 text-viewerlighttext" />
                           Owner
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-2 @max-lg/frame:flex-col @max-lg/frame:items-stretch">
                     <div className="flex h-9 w-72 items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-viewerlighttext @max-lg/frame:w-full">
                        <Search className="size-4 shrink-0" />
                        <span className="flex-1">Filter buckets…</span>
                        <Key>/</Key>
                     </div>
                     <div className="flex h-11 items-center gap-2">
                        <button
                           type="button"
                           tabIndex={-1}
                           className={cn(
                              OUTLINE,
                              "@max-lg/frame:w-9 @max-lg/frame:justify-center @max-lg/frame:px-0"
                           )}
                        >
                           <RefreshCw className="size-4 shrink-0" />
                           <span className="@max-lg/frame:sr-only">
                              Refresh
                           </span>
                        </button>
                        <button type="button" tabIndex={-1} className={OUTLINE}>
                           <UserRoundPlus className="size-4" />
                           Invite
                        </button>
                        <button type="button" tabIndex={-1} className={PRIMARY}>
                           <Plus className="size-4" />
                           Create bucket
                        </button>
                     </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite">
                     <div className="flex h-11 shrink-0 items-center border-b border-viewerborder bg-viewergray/60 text-[13px] font-medium text-viewertext">
                        <span className={NAME_COL}>Name</span>
                        <span className={CREATED_COL}>Created</span>
                        <span className={ROLE_COL}>Your role</span>
                        <span className={ACTIONS_COL} />
                     </div>
                     <Layers
                        activeId={current.id}
                        servers={SERVERS}
                        className="h-44 @lg/frame:h-66"
                        render={(server) =>
                           [
                              ...server.buckets,
                              ...(WIDE_EXTRA[server.id] ?? []),
                           ].map((bucket, i) => (
                              <div
                                 key={bucket}
                                 className={cn(
                                    "flex h-11 w-full cursor-pointer items-center border-b border-viewerborder text-viewerblack transition-colors duration-150 hover:bg-viewergray/60 motion-reduce:transition-none",
                                    i >= server.buckets.length && WIDE_ONLY
                                 )}
                              >
                                 <span
                                    className={cn(
                                       NAME_COL,
                                       "flex items-center gap-2.5"
                                    )}
                                 >
                                    <Folder className="size-4 shrink-0 text-viewertext" />
                                    <span className="truncate">{bucket}</span>
                                 </span>
                                 <span
                                    className={cn(
                                       CREATED_COL,
                                       "text-viewerblack tabular-nums"
                                    )}
                                 >
                                    {CREATED[bucket]}
                                 </span>
                                 <span className={ROLE_COL}>Owner</span>
                                 <span className={ACTIONS_COL}>
                                    <Ellipsis className="size-4 text-viewertext" />
                                 </span>
                              </div>
                           ))
                        }
                     />
                     <div className="mt-auto flex h-12 shrink-0 items-center justify-between border-t border-viewerborder px-4 @max-lg/frame:justify-end @max-lg/frame:px-2">
                        <Layers
                           activeId={current.id}
                           servers={SERVERS}
                           className={cn("h-5 w-48", WIDE_ONLY)}
                           render={(server) => (
                              <span className="tabular-nums">
                                 Showing 1–
                                 {server.buckets.length +
                                    (WIDE_EXTRA[server.id]?.length ?? 0)}{" "}
                                 of{" "}
                                 {server.buckets.length +
                                    (WIDE_EXTRA[server.id]?.length ?? 0)}
                              </span>
                           )}
                        />
                        <div className="flex items-center gap-2">
                           <span className={WIDE_ONLY}>Rows per page</span>
                           <span className="inline-flex h-8 w-20 items-center justify-between rounded-lg border border-viewerborder px-3 text-[13px] font-medium text-viewertext tabular-nums">
                              100
                              <ChevronDown className="size-3.5 text-viewerlighttext" />
                           </span>
                           <span className="flex items-center gap-1 text-viewerlighttext">
                              <span className="grid size-8 place-items-center">
                                 <ChevronLeft className="size-4" />
                              </span>
                              <span className="grid size-8 place-items-center">
                                 <ChevronRight className="size-4" />
                              </span>
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </ScaledFrame>
   );
};
