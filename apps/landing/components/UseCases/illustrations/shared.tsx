import { AwsArtwork, CloudflarePaths } from "@/components/provider-art";
import { useInView } from "@/lib/hooks/use-in-view";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { C } from "@/lib/palette";
import type { ProviderId } from "@/lib/provider-paths";
import { useEffect, type ReactNode } from "react";

export { C };

export const SAMPLE_BUCKETS = ["assets", "backups", "media", "logs"];

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

// svg text collapses leading spaces, so swap them for non-breaking ones
export const keepIndent = (line: string) =>
   line.replace(/^ +/, (m) => "\u00A0".repeat(m.length));

export const IllustrationFrame = ({
   label,
   children,
}: {
   label: string;
   children: ReactNode;
}) => (
   <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-viewerborder bg-viewergray">
      <div
         role="img"
         aria-label={label}
         className="absolute inset-0 grid place-items-center p-5 sm:p-8"
      >
         {children}
      </div>
   </div>
);

export const SVGRoot = ({ children }: { children: ReactNode }) => {
   const [ref, inView] = useInView<SVGSVGElement>("160px");
   const visible = usePageVisible();
   const running = inView && visible;
   useEffect(() => {
      const svg = ref.current;
      if (
         !svg ||
         typeof svg.pauseAnimations !== "function" ||
         typeof svg.unpauseAnimations !== "function"
      )
         return;
      if (running) svg.unpauseAnimations();
      else svg.pauseAnimations();
   }, [running, ref]);
   return (
      <svg
         ref={ref}
         viewBox="0 0 480 360"
         fill="none"
         xmlns="http://www.w3.org/2000/svg"
         className="relative size-full max-h-full max-w-full"
         preserveAspectRatio="xMidYMid meet"
         fontFamily="inherit"
         aria-hidden
      >
         {children}
      </svg>
   );
};

type XY = { x: number; y: number };

export const Txt = ({
   x,
   y,
   children,
   size = 12,
   weight = 500,
   fill = C.text,
   mono,
   anchor,
   caps,
   opacity,
}: XY & {
   children: ReactNode;
   size?: number;
   weight?: 400 | 500 | 600;
   fill?: string;
   mono?: boolean;
   anchor?: "start" | "middle" | "end";
   caps?: boolean;
   opacity?: number;
}) => (
   <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      fontFamily={mono ? MONO : "inherit"}
      textAnchor={anchor}
      letterSpacing={caps ? "0.08em" : undefined}
      opacity={opacity}
   >
      {children}
   </text>
);

export const Card = ({
   x,
   y,
   w,
   h,
   rx = 8,
   shadow = true,
   fill = C.white,
   stroke = C.border,
   dash,
   children,
}: XY & {
   w: number;
   h: number;
   rx?: number;
   shadow?: boolean;
   fill?: string;
   stroke?: string;
   dash?: string;
   children?: ReactNode;
}) => (
   <g transform={`translate(${x} ${y})`}>
      {shadow && (
         <rect
            y={4}
            width={w}
            height={h}
            rx={rx}
            fill={C.black}
            opacity={0.05}
         />
      )}
      <rect
         width={w}
         height={h}
         rx={rx}
         fill={fill}
         stroke={stroke}
         strokeWidth={1.25}
         strokeDasharray={dash}
      />
      {children}
   </g>
);

export const HR = ({ x, y, w }: XY & { w: number }) => (
   <line x1={x} y1={y} x2={x + w} y2={y} stroke={C.border} strokeWidth={1} />
);

export const Chip = ({
   x,
   y,
   w,
   label,
   mono,
   fill = C.gray,
   color = C.text,
   size = 11,
}: XY & {
   w: number;
   label: string;
   mono?: boolean;
   fill?: string;
   color?: string;
   size?: number;
}) => (
   <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={20} rx={4} fill={fill} />
      <Txt
         x={w / 2}
         y={14}
         size={size}
         anchor="middle"
         mono={mono}
         fill={color}
      >
         {label}
      </Txt>
   </g>
);

export const Btn = ({
   x,
   y,
   w,
   h = 28,
   label,
   kind = "primary",
   icon,
   color,
}: XY & {
   w: number;
   h?: number;
   label: string;
   kind?: "primary" | "ghost" | "danger";
   icon?: IconName;
   color?: string;
}) => {
   const filled = kind === "primary" || kind === "danger";
   const fg = color ?? (filled ? C.white : C.black);
   return (
      <g transform={`translate(${x} ${y})`}>
         <rect
            width={w}
            height={h}
            rx={6}
            fill={
               kind === "primary" ? C.blue : kind === "danger" ? C.red : C.white
            }
            stroke={kind === "ghost" ? C.border : undefined}
            strokeWidth={1.25}
         />
         {icon && (
            <Icon name={icon} x={12} y={h / 2 - 7} size={14} color={fg} />
         )}
         <Txt
            x={icon ? 32 : w / 2}
            y={h / 2 + 4}
            size={12}
            weight={600}
            fill={fg}
            anchor={icon ? "start" : "middle"}
         >
            {label}
         </Txt>
      </g>
   );
};

export const Field = ({
   x,
   y,
   w,
   h = 28,
   active,
   children,
}: XY & { w: number; h?: number; active?: boolean; children?: ReactNode }) => (
   <g transform={`translate(${x} ${y})`}>
      <rect
         width={w}
         height={h}
         rx={6}
         fill={C.white}
         stroke={active ? C.blue : C.border}
         strokeWidth={1.25}
      />
      {children}
   </g>
);

const Checkbox = ({
   x,
   y,
   checked,
   mixed,
}: XY & { checked?: boolean; mixed?: boolean }) => (
   <g transform={`translate(${x} ${y})`}>
      <rect
         width={14}
         height={14}
         rx={3}
         fill={checked || mixed ? C.blue : C.white}
         stroke={checked || mixed ? C.blue : C.border}
         strokeWidth={1.25}
      />
      {checked && (
         <path
            d="M3.5 7.2l2.3 2.3 4.7-4.8"
            stroke={C.white}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
         />
      )}
      {mixed && !checked && (
         <path
            d="M4 7h6"
            stroke={C.white}
            strokeWidth={1.6}
            strokeLinecap="round"
         />
      )}
   </g>
);

export const Avatar = ({
   x,
   y,
   initials,
   r = 12,
   fill = C.blue,
}: XY & { initials: string; r?: number; fill?: string }) => (
   <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={fill} />
      <Txt
         x={0}
         y={r * 0.36}
         size={r * 0.8}
         weight={600}
         fill={C.white}
         anchor="middle"
      >
         {initials}
      </Txt>
   </g>
);

export const Cursor = ({ x, y }: XY) => (
   <path
      transform={`translate(${x} ${y})`}
      d="M0 0v14.5l3.6-3.2 2.6 5.6 2.4-1.1-2.6-5.5h4.8Z"
      fill={C.black}
      stroke={C.white}
      strokeWidth={1.2}
      strokeLinejoin="round"
   />
);

const ICONS = {
   folder:
      "M1.5 4.5A1 1 0 0 1 2.5 3.5h3.6l1.6 1.6h5.8a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z",
   file: "M4 1.5h5.5L13 5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM9.5 1.5V5H13",
   search: "M12.5 12.5 9.8 9.8M6.5 11a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z",
   chevronDown: "M4 6l4 4 4-4",
   chevronRight: "M6 4l4 4-4 4",
   chevronsUpDown: "M5 6l3-3 3 3M5 10l3 3 3-3",
   kebab: "M8 3.5v.01M8 8v.01M8 12.5v.01",
   check: "M3 8.5l3 3 7-7",
   plus: "M8 3v10M3 8h10",
   lock: "M4 7.5h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1ZM5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5",
   key: "M5.5 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7.6 8.4l6-6M11.5 4.5l2 2",
   download: "M8 2.5v8M4.5 7l3.5 3.5L11.5 7M3 13.5h10",
   upload:
      "M4.5 12.5a3 3 0 0 1-.3-6 4.5 4.5 0 0 1 8.7 1 2.5 2.5 0 0 1-.4 5H11.5M8 14.5V8.5M5.5 11 8 8.5l2.5 2.5",
   trash: "M2.5 4h11M5.5 4V2.5h5V4M4 4l.7 9.5h6.6L12 4",
   info: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 7.5v4M8 4.8v.6",
   clock: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 4.5V8l2.5 1.5",
   link: "M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 8.5 4l-1 1M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7.5 12l1-1",
   pencil: "M11 2.5l2.5 2.5-8 8H3v-2.5Z",
   server: "M2.5 2.5h11v4h-11ZM2.5 9.5h11v4h-11ZM5 4.5v.01M5 11.5v.01",
   monitor: "M2 3h12v8H2ZM6 13.5h4M8 11v2.5",
   switch: "M3 5.5h10l-3-3M13 10.5H3l3 3",
   mail: "M2 4h12v8H2ZM2 4l6 5 6-5",
   bucket:
      "M2.5 3.5h11l-1.2 9.5a1 1 0 0 1-1 .9H4.7a1 1 0 0 1-1-.9ZM2.5 3.5a5.5 2 0 0 1 11 0a5.5 2 0 0 1-11 0",
   x: "M4.5 4.5l7 7M11.5 4.5l-7 7",
   shield:
      "M8 1.5l5.5 2v4.2c0 3.2-2.3 5.6-5.5 6.8-3.2-1.2-5.5-3.6-5.5-6.8V3.5Z",
} as const;

type IconName = keyof typeof ICONS;

export const Icon = ({
   name,
   x,
   y,
   size = 16,
   color = C.text,
   sw = 1.5,
}: XY & { name: IconName; size?: number; color?: string; sw?: number }) => (
   <path
      transform={`translate(${x} ${y}) scale(${size / 16})`}
      d={ICONS[name]}
      stroke={color}
      strokeWidth={name === "kebab" || name === "server" ? sw + 1 : sw}
      strokeLinecap="round"
      strokeLinejoin="round"
   />
);

export const CloudflareGlyph = ({
   x,
   y,
   size = 16,
}: XY & { size?: number }) => (
   <g transform={`translate(${x} ${y}) scale(${size / 32})`}>
      <CloudflarePaths />
   </g>
);

const AwsGlyph = ({ x, y, size = 20 }: XY & { size?: number }) => (
   <g transform={`translate(${x} ${y}) scale(${size / 32})`}>
      <AwsArtwork />
   </g>
);

export type Provider = ProviderId | "server";

const TILE = 24;
const TILE_INNER = TILE * 0.66;
const TILE_INSET = (TILE - TILE_INNER) / 2;

export const ProviderTile = ({
   x,
   y,
   provider,
}: XY & { provider: Provider }) => (
   <g transform={`translate(${x} ${y})`}>
      <rect
         width={TILE}
         height={TILE}
         rx={TILE / 4}
         fill={C.white}
         stroke={C.border}
         strokeWidth={1.25}
      />
      {provider === "cloudflare" && (
         <CloudflareGlyph x={TILE_INSET} y={TILE_INSET} size={TILE_INNER} />
      )}
      {provider === "aws" && (
         <AwsGlyph x={2} y={(TILE - (TILE - 4) * 0.75) / 2} size={TILE - 4} />
      )}
      {provider === "server" && (
         <Icon
            name="server"
            x={TILE_INSET}
            y={TILE_INSET}
            size={TILE_INNER}
            color={C.text}
            sw={1.4}
         />
      )}
   </g>
);

export const ObjectRow = ({
   x,
   y,
   w,
   h = 32,
   name,
   size,
   date,
   kind = "file",
   selected,
   hover,
   faded,
   check,
   menu,
   sizeX,
   dateX,
   children,
}: XY & {
   w: number;
   h?: number;
   name: ReactNode;
   size?: string;
   date?: string;
   kind?: "file" | "folder";
   selected?: boolean;
   hover?: boolean;
   faded?: boolean;
   check?: boolean;
   menu?: boolean;
   sizeX?: number;
   dateX?: number;
   children?: ReactNode;
}) => {
   const folder = kind === "folder";
   const iconX = check === undefined ? 12 : 34;
   return (
      <g transform={`translate(${x} ${y})`} opacity={faded ? 0.38 : 1}>
         {selected && (
            <rect width={w} height={h} fill={C.blue} opacity={0.06} />
         )}
         {hover && <rect width={w} height={h} fill={C.gray} />}
         {check !== undefined && (
            <Checkbox x={12} y={h / 2 - 7} checked={check} />
         )}
         <Icon
            name={folder ? "folder" : "file"}
            x={iconX}
            y={h / 2 - 8}
            color={folder ? C.blue : C.light}
            sw={1.4}
         />
         <Txt
            x={iconX + 22}
            y={h / 2 + 4}
            fill={folder ? C.blue : C.black}
            weight={folder ? 600 : 500}
         >
            {name}
         </Txt>
         {size && (
            <Txt x={sizeX ?? w * 0.54} y={h / 2 + 4} size={11.5} fill={C.text}>
               {size}
            </Txt>
         )}
         {date && (
            <Txt x={dateX ?? w * 0.72} y={h / 2 + 4} size={11.5} fill={C.text}>
               {date}
            </Txt>
         )}
         {menu && (
            <Icon
               name="kebab"
               x={w - 26}
               y={h / 2 - 8}
               color={C.light}
               sw={1}
            />
         )}
         {children}
         <HR x={0} y={h} w={w} />
      </g>
   );
};

export const ServerHeader = ({
   w,
   name,
   provider,
}: {
   w: number;
   name: string;
   provider: Provider;
}) => (
   <>
      <ProviderTile x={12} y={8} provider={provider} />
      <Txt x={44} y={25} weight={600} fill={C.black}>
         {name}
      </Txt>
      <Icon name="chevronsUpDown" x={w - 28} y={12} color={C.light} />
      <HR x={0} y={40} w={w} />
   </>
);

export const BucketRows = ({
   y,
   w,
   rowH,
}: {
   y: number;
   w: number;
   rowH: number;
}) => (
   <>
      {SAMPLE_BUCKETS.map((bucket, i) => (
         <ObjectRow
            key={bucket}
            x={0}
            y={y + i * rowH}
            w={w}
            h={rowH}
            name={bucket}
            kind="folder"
         >
            <Icon
               name="chevronRight"
               x={w - 26}
               y={(rowH - 16) / 2}
               color={C.light}
            />
         </ObjectRow>
      ))}
   </>
);

export const MatchText = ({ text, match }: { text: string; match: string }) => (
   <>
      <tspan fill={C.blue} fontWeight={600}>
         {match}
      </tspan>
      {text.slice(match.length)}
   </>
);

export const HeaderRow = ({
   x,
   y,
   w,
   h = 24,
   cols,
   check,
}: XY & {
   w: number;
   h?: number;
   cols: { label: string; x: number }[];
   check?: "none" | "mixed" | "all";
}) => (
   <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} fill={C.gray} />
      {check && (
         <Checkbox
            x={12}
            y={h / 2 - 7}
            checked={check === "all"}
            mixed={check === "mixed"}
         />
      )}
      {cols.map((c) => (
         <Txt key={c.label} x={c.x} y={h / 2 + 4} size={11} fill={C.light}>
            {c.label}
         </Txt>
      ))}
   </g>
);

export const Motion = ({
   still,
   children,
}: {
   still?: ReactNode;
   children: ReactNode;
}) => {
   const reduced = useReducedMotion();
   return <>{reduced ? still : children}</>;
};

const ease = (n: number) => Array(n).fill(".45 0 .25 1").join(";");

// the animation primitives render nothing under reduced motion, which leaves
// their parent in its static (untransformed, fully opaque) state.
export const Glide = ({
   values,
   keyTimes,
   dur,
   type = "translate",
}: {
   values: string;
   keyTimes: string;
   dur: string;
   type?: "translate" | "scale" | "rotate";
}) =>
   useReducedMotion() ? null : (
      <animateTransform
         attributeName="transform"
         type={type}
         values={values}
         keyTimes={keyTimes}
         keySplines={ease(values.split(";").length - 1)}
         calcMode="spline"
         dur={dur}
         repeatCount="indefinite"
      />
   );

export const Spin = ({
   cx,
   cy,
   dur,
}: {
   cx: number;
   cy: number;
   dur: string;
}) =>
   useReducedMotion() ? null : (
      <animateTransform
         attributeName="transform"
         type="rotate"
         from={`0 ${cx} ${cy}`}
         to={`360 ${cx} ${cy}`}
         dur={dur}
         repeatCount="indefinite"
      />
   );

export const Fade = ({
   values,
   keyTimes,
   dur,
   blink,
}: {
   values: string;
   keyTimes?: string;
   dur: string;
   blink?: boolean;
}) =>
   useReducedMotion() ? null : (
      <animate
         attributeName="opacity"
         values={values}
         keyTimes={keyTimes}
         calcMode={blink ? "discrete" : undefined}
         dur={dur}
         repeatCount="indefinite"
      />
   );

const Flow = ({
   period = 20,
   dur = "1.4s",
}: {
   period?: number;
   dur?: string;
}) =>
   useReducedMotion() ? null : (
      <animate
         attributeName="stroke-dashoffset"
         from={period}
         to={0}
         dur={dur}
         repeatCount="indefinite"
      />
   );

export const FlowLine = ({ d, width = 1.5 }: { d: string; width?: number }) => (
   <>
      <path d={d} stroke={C.blue} strokeWidth={width} strokeLinecap="round" />
      <Motion>
         <path
            d={d}
            stroke={C.white}
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray="5 15"
            opacity={0.85}
         >
            <Flow />
         </path>
      </Motion>
   </>
);

export const DashLine = ({ d }: { d: string }) => (
   <path d={d} stroke={C.light} strokeWidth={1.25} strokeDasharray="3 4">
      <Flow period={7} dur="1.2s" />
   </path>
);

export const Caret = ({ x, y }: XY) => (
   <rect x={x} y={y} width={1.5} height={14} fill={C.blue}>
      <Fade values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" blink />
   </rect>
);
