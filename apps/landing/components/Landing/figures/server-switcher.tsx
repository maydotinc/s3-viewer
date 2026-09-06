import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronRight, ChevronsUpDown, Folder, Plus } from "lucide-react";
import { ReactNode } from "react";
import { ScaledFrame } from "./frame";
import { ProviderId, ProviderMark, ProviderTile } from "./provider-marks";
import { useAutoplay } from "./use-autoplay";
import { useHoverPause } from "./use-hover-pause";
import { useInView } from "./use-in-view";

export type Server = {
   id: string;
   name: string;
   provider: ProviderId;
   buckets: string[];
};

export const SERVERS: Server[] = [
   {
      id: "may",
      name: "May Inc.",
      provider: "cloudflare",
      buckets: ["barberflow", "s3-viewer", "pastsmalltalk", "crayo"],
   },
   {
      id: "backup",
      name: "Backup S3",
      provider: "aws",
      buckets: ["nightly-db", "media-archive", "logs", "snapshots"],
   },
];

export const HOVER_FILL =
   "cursor-pointer transition-colors duration-150 hover:bg-viewergray motion-reduce:transition-none";

const ITEM = "flex w-full items-center gap-2.5 text-sm text-viewerblack";

type LayersProps = {
   activeId: string;
   servers: Server[];
   className: string;
   render: (server: Server) => ReactNode;
};

// one absolutely positioned layer per server, crossfaded in place so the
// box keeps its height whichever server is selected
export const Layers = ({
   activeId,
   servers,
   className,
   render,
}: LayersProps) => (
   <div className={cn("relative", className)}>
      {servers.map((server) => (
         <div
            key={server.id}
            className={cn(
               "absolute inset-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
               server.id === activeId
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-1 opacity-0"
            )}
         >
            {render(server)}
         </div>
      ))}
   </div>
);

type ServerSwitcherProps = {
   servers: Server[];
   currentId: string;
   onSelect: (id: string) => void;
   open: boolean;
   className?: string;
};

export const ServerSwitcher = ({
   servers,
   currentId,
   onSelect,
   open,
   className,
}: ServerSwitcherProps) => {
   const current = servers.find((server) => server.id === currentId);
   if (!current) return null;

   return (
      <div
         className={cn(
            "relative cursor-default rounded-xl border border-viewerborder bg-viewerwhite p-2",
            className
         )}
      >
         <div className="flex h-12 items-center gap-2.5 rounded-lg bg-viewergray px-3">
            <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
            <ProviderTile>
               <ProviderMark provider={current.provider} />
            </ProviderTile>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-viewerblack">
               {current.name}
            </span>
            <button
               type="button"
               tabIndex={-1}
               className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border border-viewerlighttext bg-viewerwhite text-viewerblack"
            >
               <ChevronsUpDown className="size-3.5" />
            </button>
         </div>

         <Layers
            activeId={current.id}
            servers={servers}
            className="mt-1 h-36"
            render={(server) =>
               server.buckets.map((bucket) => (
                  <button
                     key={bucket}
                     type="button"
                     tabIndex={-1}
                     className={cn(ITEM, HOVER_FILL, "h-9 rounded-lg px-2")}
                  >
                     <Folder className="size-4 shrink-0 text-viewerblue" />
                     <span className="min-w-0 flex-1 truncate text-left">
                        {bucket}
                     </span>
                     <ChevronRight className="size-4 shrink-0 text-viewerlighttext" />
                  </button>
               ))
            }
         />

         <div
            className={cn(
               "absolute top-13 -left-2 right-2 z-10 rounded-xl border border-viewerborder bg-viewerwhite p-1 shadow-md transition-opacity duration-150 motion-reduce:transition-none",
               open ? "opacity-100" : "pointer-events-none opacity-0"
            )}
         >
            {servers.map((server) => (
               <button
                  key={server.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onSelect(server.id)}
                  className={cn(ITEM, HOVER_FILL, "h-9 rounded-md px-2.5")}
               >
                  <span className="grid size-6 shrink-0 place-items-center">
                     <span
                        className={cn(
                           "size-4 rounded-full bg-viewerwhite",
                           server.id === current.id
                              ? "border-[5px] border-viewerblue"
                              : "border border-viewerborder"
                        )}
                     />
                  </span>
                  <ProviderTile>
                     <ProviderMark provider={server.provider} />
                  </ProviderTile>
                  <span className="min-w-0 flex-1 truncate text-left">
                     {server.name}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-viewerlighttext" />
               </button>
            ))}
            <div className="-mx-1 my-1 border-t border-viewerborder" />
            <button
               type="button"
               tabIndex={-1}
               className={cn(ITEM, HOVER_FILL, "h-9 rounded-md px-2.5")}
            >
               <span className="grid size-6 shrink-0 place-items-center rounded-full border border-viewerborder text-viewerlighttext">
                  <Plus className="size-3.5" />
               </span>
               Add new server
            </button>
         </div>
      </div>
   );
};

export const ServerSwitcherFigure = () => {
   const [ref, inView] = useInView<HTMLDivElement>();
   const { hovered, hoverProps } = useHoverPause();
   const [step, jump] = useAutoplay({
      steps: SERVERS.length,
      interval: 3200,
      active: inView && !hovered,
   });

   return (
      <div ref={ref} {...hoverProps} className="w-full">
         <ScaledFrame
            width={480}
            height={360}
            label="The server switcher in the S3 Viewer sidebar: May Inc. on Cloudflare R2 and Backup S3 on Amazon S3, with the bucket list underneath"
         >
            <div className="grid size-full cursor-default place-items-center">
               <ServerSwitcher
                  servers={SERVERS}
                  currentId={SERVERS[step]?.id ?? ""}
                  onSelect={(id) =>
                     jump(SERVERS.findIndex((server) => server.id === id))
                  }
                  open
                  className="w-[300px]"
               />
            </div>
         </ScaledFrame>
      </div>
   );
};
