import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ChevronDown,
   ListFilter,
   Plus,
   Search,
   User,
   UserPlus,
} from "lucide-react";
import Image from "next/image";
import { ReactNode, useState } from "react";
import { ScaledFrame } from "./frame";
import type { ProviderId } from "@/lib/provider-paths";
import { ProviderMark, ProviderChip } from "./provider-marks";
import {
   HOVER_FILL,
   Layers,
   PRIMARY_SERVER,
   SERVERS,
   ServerSwitcher,
} from "./server-switcher";

const CREATED: Record<string, string> = {
   barberflow: "2025-07-08",
   "s3-viewer": "2026-01-02",
   pastsmalltalk: "2025-10-21",
   crayo: "2026-02-05",
   "nightly-db": "2026-03-11",
   "media-archive": "2025-12-02",
   logs: "2026-08-19",
   snapshots: "2026-06-30",
   "may-site": "2025-05-14",
   "email-assets": "2025-09-03",
   "user-uploads": "2026-04-22",
   exports: "2026-07-15",
   "pg-wal": "2025-11-27",
   "audit-trail": "2026-02-18",
   "cold-storage": "2026-05-09",
   "ci-artifacts": "2026-09-01",
};

// the sidebar keeps the four buckets every figure shares; the wide table adds
// these so the taller laptop frame fills with rows instead of blank space
const WIDE_EXTRA: Record<string, string[]> = {
   may: ["may-site", "email-assets", "user-uploads", "exports"],
   backup: ["pg-wal", "audit-trail", "cold-storage", "ci-artifacts"],
};

const PROVIDER_NAME: Record<ProviderId, string> = {
   cloudflare: "Cloudflare",
   aws: "Amazon S3",
};

const OUTLINE = cn(
   "inline-flex h-9 items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-4 text-sm font-medium whitespace-nowrap text-viewertext hover:text-viewerblack",
   HOVER_FILL
);

const WIDE_ONLY = "@max-lg/frame:hidden";

const StatChip = ({
   icon,
   label,
   value,
}: {
   icon: ReactNode;
   label: string;
   value: string;
}) => (
   <div className="flex h-12 items-center gap-2.5 rounded-lg border border-viewerborder bg-viewerwhite px-3">
      <ProviderChip className="size-8">{icon}</ProviderChip>
      <div className="flex min-w-20 flex-col">
         <span className="text-xs leading-4 text-viewerlighttext">{label}</span>
         <span className="text-sm leading-5 font-medium text-viewerblack">
            {value}
         </span>
      </div>
   </div>
);

export const AppHeroFigure = () => {
   const [currentId, setCurrentId] = useState(PRIMARY_SERVER.id);
   const current = SERVERS.find((server) => server.id === currentId);
   if (!current) return null;

   return (
      <ScaledFrame
         width={1024}
         height={640}
         narrow={{ width: 400, height: 540 }}
         label="S3 Viewer dashboard: sidebar with the server switcher open and the buckets table for May Inc."
      >
         <div className="flex size-full cursor-default flex-col bg-viewergray text-sm text-viewertext">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-viewerborder px-8">
               <Image
                  src="/icons/viewer.svg"
                  alt=""
                  width={150}
                  height={32}
                  priority
                  draggable={false}
                  className="h-8 w-auto shrink-0"
               />
               <button
                  type="button"
                  tabIndex={-1}
                  className={cn(
                     "inline-flex h-9 items-center gap-2 rounded-full border border-viewerborder bg-viewerwhite px-4 text-sm font-medium text-viewerblack",
                     HOVER_FILL
                  )}
               >
                  Mike
                  <ChevronDown className="size-3.5 text-viewertext" />
               </button>
            </div>

            <div className="flex min-h-0 flex-1">
               <div
                  className={cn(
                     "w-64 shrink-0 border-r border-viewerborder px-4 py-5",
                     WIDE_ONLY
                  )}
               >
                  <p className="mb-2 px-2 text-[11px] font-medium tracking-wide text-viewerlighttext uppercase">
                     Servers
                  </p>
                  <ServerSwitcher
                     servers={SERVERS}
                     currentId={current.id}
                     onSelect={setCurrentId}
                     open
                  />
               </div>

               <div className="min-w-0 flex-1 bg-viewerwhite">
                  <div className="flex items-center justify-between gap-4 border-b border-viewerborder px-6 pt-5 pb-4 @max-lg/frame:flex-col @max-lg/frame:items-start">
                     <div>
                        <p className="text-xl font-semibold text-viewerblack">
                           Buckets Overview
                        </p>
                        <p className="text-sm text-viewertext">
                           Navigate through your buckets and view their contents
                        </p>
                     </div>
                     <div className="flex gap-3">
                        <StatChip
                           icon={
                              <ProviderMark
                                 provider={current.provider}
                                 className="size-5"
                              />
                           }
                           label="Provider"
                           value={PROVIDER_NAME[current.provider]}
                        />
                        <StatChip
                           icon={
                              <User
                                 className="size-4 text-viewerblue"
                                 fill="currentColor"
                              />
                           }
                           label="Role"
                           value="Owner"
                        />
                     </div>
                  </div>

                  <div className="mt-4 flex h-9 items-center gap-2 px-6">
                     <div className="flex h-9 w-56 min-w-0 items-center gap-2 rounded-lg @max-lg/frame:flex-1 border border-viewerborder bg-viewerwhite px-3 text-sm text-viewerlighttext">
                        <Search className="size-4 shrink-0" />
                        Search...
                     </div>
                     <button
                        type="button"
                        tabIndex={-1}
                        className={cn(OUTLINE, WIDE_ONLY)}
                     >
                        <ListFilter className="size-4" />
                        Filter
                     </button>
                     <button
                        type="button"
                        tabIndex={-1}
                        className={cn(OUTLINE, WIDE_ONLY)}
                     >
                        Rows (100)
                        <ChevronDown className="size-4 text-viewerlighttext" />
                     </button>
                     <button
                        type="button"
                        tabIndex={-1}
                        className={cn(OUTLINE, "ml-auto", WIDE_ONLY)}
                     >
                        <UserPlus className="size-4" />
                        Share
                     </button>
                     <button
                        type="button"
                        tabIndex={-1}
                        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-viewerblue px-4 text-sm font-medium whitespace-nowrap text-viewerwhite transition-colors duration-150 hover:bg-viewerdarkblue motion-reduce:transition-none"
                     >
                        <Plus className="size-4" />
                        Create Bucket
                     </button>
                  </div>

                  <div className="px-6 pt-4">
                     <div className="flex h-11 items-center rounded-md bg-viewergray/60 text-[13px] font-medium text-viewertext">
                        <span className="w-2/3 px-4 @max-lg/frame:w-1/2">
                           Bucket Name
                        </span>
                        <span className="px-4">Creation Date</span>
                     </div>
                     <Layers
                        activeId={current.id}
                        servers={SERVERS}
                        className="h-44 @lg/frame:h-88"
                        render={(server) =>
                           [
                              ...server.buckets,
                              ...(WIDE_EXTRA[server.id] ?? []),
                           ].map((bucket, i) => (
                              <button
                                 key={bucket}
                                 type="button"
                                 tabIndex={-1}
                                 className={cn(
                                    "flex h-11 w-full cursor-pointer items-center border-b border-viewerborder text-sm text-viewerblack transition-colors duration-150 hover:bg-viewergray/60 motion-reduce:transition-none",
                                    i >= server.buckets.length && WIDE_ONLY
                                 )}
                              >
                                 <span className="w-2/3 truncate px-4 text-left @max-lg/frame:w-1/2">
                                    {bucket}
                                 </span>
                                 <span className="px-4 text-viewertext tabular-nums">
                                    {CREATED[bucket]}
                                 </span>
                              </button>
                           ))
                        }
                     />
                  </div>
               </div>
            </div>
         </div>
      </ScaledFrame>
   );
};
