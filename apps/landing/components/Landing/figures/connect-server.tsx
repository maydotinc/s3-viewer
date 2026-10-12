import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   Check,
   ChevronDown,
   ChevronRight,
   ChevronsUpDown,
   Folder,
   Plus,
   Server,
} from "lucide-react";
import { ReactNode } from "react";
import MotionToggle from "@/components/motion-toggle";
import { FadePanel } from "./fade-panel";
import { ScaledFrame } from "./frame";
import { CloudflareMark, ProviderChip } from "./provider-marks";
import { PRIMARY_SERVER } from "./server-switcher";
import { useAutoplay } from "./use-autoplay";

const STEPS = 4;
const { name: NAME, buckets: BUCKETS } = PRIMARY_SERVER;
const ENDPOINT = "https://acme.r2.cloudflarestorage.com";

const FADE =
   "transition-[opacity,transform] duration-300 motion-reduce:transition-none";

const Layer = ({
   active,
   className,
   children,
}: {
   active: boolean;
   className?: string;
   children: ReactNode;
}) => (
   <FadePanel
      active={active}
      className={cn("flex flex-col justify-center p-4 duration-300", className)}
   >
      {children}
   </FadePanel>
);

const Title = ({
   children,
   description,
}: {
   children: ReactNode;
   description: ReactNode;
}) => (
   <div className="flex flex-col gap-1">
      <p className="text-base font-semibold text-viewerblack">{children}</p>
      <div className="text-sm text-viewertext">{description}</div>
   </div>
);

const Field = ({
   label,
   value,
   trailing,
}: {
   label: string;
   value: string;
   trailing?: ReactNode;
}) => (
   <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm font-medium text-viewerblack">{label}</span>
      <span className="flex h-9 items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-sm text-viewerblack">
         <span className="min-w-0 flex-1 truncate">{value}</span>
         {trailing}
      </span>
   </div>
);

const SidebarRow = ({
   className,
   children,
   style,
}: {
   className?: string;
   children: ReactNode;
   style?: React.CSSProperties;
}) => (
   <div
      style={style}
      className={cn(
         "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors duration-150 hover:bg-viewergray",
         className
      )}
   >
      {children}
   </div>
);

export const ConnectServerFigure = () => {
   const {
      step,
      jump: setStep,
      paused,
      togglePaused,
      rootProps,
   } = useAutoplay({ steps: STEPS, interval: 2800 });
   const next = () => setStep(step + 1);

   return (
      <div {...rootProps} className="relative w-full">
         <ScaledFrame
            width={480}
            height={360}
            narrow={{ width: 380, height: 330 }}
            narrowAt="sm"
            label="Connecting a server in S3 Viewer: the empty state, the connect form, the server-found confirmation and the connected sidebar"
         >
            <div className="flex h-full cursor-default flex-col items-center justify-center">
               <div className="relative h-[300px] w-[360px] rounded-xl border border-viewerborder bg-viewerwhite shadow-sm">
                  <Layer
                     active={step === 0}
                     className="items-center text-center"
                  >
                     <span className="grid size-12 place-items-center rounded-xl bg-viewergray">
                        <Server className="size-6 text-viewerblue" />
                     </span>
                     <p className="mt-3 text-base font-semibold text-viewerblack">
                        Connect a server to get started
                     </p>
                     <p className="mt-1 text-sm text-viewertext">
                        Works with Amazon S3, Cloudflare R2 and anything
                        S3-compatible.
                     </p>
                     <Button
                        type="button"
                        tabIndex={-1}
                        onClick={next}
                        className="mt-4"
                     >
                        <Plus />
                        Connect server
                     </Button>
                  </Layer>

                  <Layer active={step === 1}>
                     <Title description="Credentials are encrypted before they leave your browser.">
                        Connect a server
                     </Title>
                     <div className="mt-3 grid grid-cols-2 gap-3">
                        <Field label="Name" value={NAME} />
                        <Field
                           label="Region"
                           value="auto (Cloudflare R2)"
                           trailing={
                              <ChevronDown className="size-4 shrink-0 text-viewerlighttext" />
                           }
                        />
                        <Field label="Endpoint" value={ENDPOINT} />
                        <Field label="Access key ID" value="•••••••• 8F2A" />
                     </div>
                     <div className="mt-3 flex justify-end">
                        <Button type="button" tabIndex={-1} onClick={next}>
                           Continue
                        </Button>
                     </div>
                  </Layer>

                  <Layer active={step === 2}>
                     <Title
                        description={
                           <span className="flex items-center gap-2">
                              <ProviderChip>
                                 <CloudflareMark />
                              </ProviderChip>
                              Cloudflare R2 · 4 buckets
                           </span>
                        }
                     >
                        Server found
                     </Title>
                     <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        <dt className="text-viewerlighttext">Name</dt>
                        <dd className="min-w-0 truncate text-viewerblack">
                           {NAME}
                        </dd>
                        <dt className="text-viewerlighttext">Endpoint</dt>
                        <dd className="min-w-0 truncate text-viewerblack">
                           {ENDPOINT}
                        </dd>
                     </dl>
                     <div className="mt-4 flex justify-between">
                        <Button
                           variant="ghost"
                           type="button"
                           tabIndex={-1}
                           onClick={() => setStep(1)}
                        >
                           Back
                        </Button>
                        <Button type="button" tabIndex={-1} onClick={next}>
                           Connect
                        </Button>
                     </div>
                  </Layer>

                  <Layer active={step === 3}>
                     <div className="flex h-6 items-center justify-between">
                        <span className="text-xs font-medium tracking-wide text-viewerlighttext uppercase">
                           Servers
                        </span>
                        <span className="inline-flex h-6 items-center gap-1 rounded-md bg-viewergray px-2 text-xs font-medium text-viewerblack">
                           <Check className="size-3 text-viewerblue" />
                           Connected
                        </span>
                     </div>
                     <SidebarRow className="mt-2 font-medium text-viewerblack">
                        <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                        <ProviderChip>
                           <CloudflareMark />
                        </ProviderChip>
                        <span className="min-w-0 flex-1 truncate">{NAME}</span>
                        <ChevronsUpDown className="size-4 shrink-0 text-viewerlighttext" />
                     </SidebarRow>
                     <div className="mt-1 flex flex-col">
                        {BUCKETS.map((bucket, i) => (
                           <SidebarRow
                              key={bucket}
                              style={{
                                 transitionDelay:
                                    step === 3 ? `${i * 60}ms` : "0ms",
                              }}
                              className={cn(
                                 FADE,
                                 "text-viewertext",
                                 step === 3
                                    ? "translate-y-0 opacity-100"
                                    : "translate-y-1 opacity-0"
                              )}
                           >
                              <Folder className="size-4 shrink-0 text-viewerblue" />
                              <span className="min-w-0 flex-1 truncate">
                                 {bucket}
                              </span>
                              <ChevronRight className="size-4 shrink-0 text-viewerlighttext" />
                           </SidebarRow>
                        ))}
                     </div>
                  </Layer>
               </div>

               <div className="mt-2 flex justify-center">
                  {Array.from({ length: STEPS }, (_, i) => (
                     <button
                        key={i}
                        type="button"
                        tabIndex={-1}
                        onClick={() => setStep(i)}
                        className="grid size-3.5 cursor-pointer place-items-center"
                     >
                        <span
                           className={cn(
                              "size-1.5 rounded-full transition-colors duration-150",
                              step === i ? "bg-viewerblue" : "bg-viewerborder"
                           )}
                        />
                     </button>
                  ))}
               </div>
            </div>
         </ScaledFrame>
         <MotionToggle paused={paused} onToggle={togglePaused} />
      </div>
   );
};
