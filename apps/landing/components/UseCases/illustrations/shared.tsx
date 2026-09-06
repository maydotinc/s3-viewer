import { useReducedMotion } from "@/components/Landing/figures/use-autoplay";
import { useInView } from "@/components/Landing/figures/use-in-view";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useEffect, type ReactNode, type SVGAttributes } from "react";

export const C = {
   blue: "#3658C1",
   darkBlue: "#253977",
   black: "#0E121B",
   text: "#525866",
   light: "#99A0AE",
   border: "#E1E4EA",
   gray: "#F7F7F7",
   white: "#FFFFFF",
   red: "#FB3748",
   redBg: "#FEEBEC",
} as const;

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const IllustrationFrame = ({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) => (
   <div
      className={cn(
         "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-viewerborder bg-viewergray",
         className
      )}
   >
      <div className="absolute inset-0 grid place-items-center p-5 sm:p-8">
         {children}
      </div>
   </div>
);

export const SVGRoot = ({
   children,
   viewBox = "0 0 480 360",
   className,
   ...rest
}: {
   children: ReactNode;
   viewBox?: string;
   className?: string;
} & SVGAttributes<SVGSVGElement>) => {
   const [ref, inView] = useInView<SVGSVGElement>("160px");
   useEffect(() => {
      const svg = ref.current;
      if (
         !svg ||
         typeof svg.pauseAnimations !== "function" ||
         typeof svg.unpauseAnimations !== "function"
      )
         return;
      if (inView) svg.unpauseAnimations();
      else svg.pauseAnimations();
   }, [inView, ref]);
   return (
      <svg
         ref={ref}
         viewBox={viewBox}
         fill="none"
         xmlns="http://www.w3.org/2000/svg"
         className={cn("relative size-full max-h-full max-w-full", className)}
         preserveAspectRatio="xMidYMid meet"
         fontFamily="inherit"
         aria-hidden
         {...rest}
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
   strike,
}: XY & {
   children: ReactNode;
   size?: number;
   weight?: 400 | 500 | 600;
   fill?: string;
   mono?: boolean;
   anchor?: "start" | "middle" | "end";
   caps?: boolean;
   opacity?: number;
   strike?: boolean;
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
      textDecoration={strike ? "line-through" : undefined}
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
   kind?: "primary" | "ghost" | "danger" | "quiet";
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
               kind === "primary"
                  ? C.blue
                  : kind === "danger"
                    ? C.red
                    : kind === "ghost"
                      ? C.white
                      : "none"
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

export const Checkbox = ({
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

export const Toggle = ({ x, y, on = true }: XY & { on?: boolean }) => (
   <g transform={`translate(${x} ${y})`}>
      <rect width={32} height={18} rx={9} fill={on ? C.blue : C.border} />
      <circle cx={on ? 23 : 9} cy={9} r={7} fill={C.white} />
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
   copy: "M6 6h7v7H6ZM3 10V3h7",
   link: "M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 8.5 4l-1 1M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7.5 12l1-1",
   pencil: "M11 2.5l2.5 2.5-8 8H3v-2.5Z",
   server: "M2.5 2.5h11v4h-11ZM2.5 9.5h11v4h-11ZM5 4.5v.01M5 11.5v.01",
   monitor: "M2 3h12v8H2ZM6 13.5h4M8 11v2.5",
   switch: "M3 5.5h10l-3-3M13 10.5H3l3 3",
   mail: "M2 4h12v8H2ZM2 4l6 5 6-5",
   bucket:
      "M2.5 3.5h11l-1.2 9.5a1 1 0 0 1-1 .9H4.7a1 1 0 0 1-1-.9ZM2.5 3.5a5.5 2 0 0 1 11 0a5.5 2 0 0 1-11 0",
} as const;

export type IconName = keyof typeof ICONS;

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
      <path
         d="M22.012 22.222c.197-.675.122-1.294-.206-1.754-.3-.422-.807-.666-1.416-.694l-11.545-.15c-.075 0-.14-.038-.178-.094s-.047-.13-.028-.206c.038-.113.15-.197.272-.206l11.648-.15c1.38-.066 2.88-1.182 3.404-2.55l.666-1.735a.38.38 0 0 0 .02-.225c-.75-3.395-3.78-5.927-7.4-5.927-3.34 0-6.17 2.157-7.184 5.15-.657-.488-1.5-.75-2.392-.666-1.604.16-2.9 1.444-3.048 3.048a3.58 3.58 0 0 0 .084 1.191A4.84 4.84 0 0 0 0 22.1c0 .234.02.47.047.703.02.113.113.197.225.197H21.58a.29.29 0 0 0 .272-.206l.16-.572z"
         fill="#f38020"
      />
      <path
         d="M25.688 14.803l-.32.01c-.075 0-.14.056-.17.13l-.45 1.566c-.197.675-.122 1.294.206 1.754.3.422.807.666 1.416.694l2.457.15c.075 0 .14.038.178.094s.047.14.028.206c-.038.113-.15.197-.272.206l-2.56.15c-1.388.066-2.88 1.182-3.404 2.55l-.188.478c-.038.094.028.188.13.188h8.797a.23.23 0 0 0 .225-.169A6.41 6.41 0 0 0 32 21.106a6.32 6.32 0 0 0-6.312-6.302"
         fill="#faae40"
      />
   </g>
);

// drawn in a 32 x 24 box; `size` is the rendered width.
export const AwsGlyph = ({ x, y, size = 20 }: XY & { size?: number }) => (
   <g transform={`translate(${x} ${y}) scale(${size / 32})`}>
      <text
         x={16}
         y={13}
         textAnchor="middle"
         fontFamily="inherit"
         fontSize={13}
         fontWeight={700}
         fill="#232f3e"
      >
         aws
      </text>
      <path
         d="M3 17.5c7 4.6 19 4.6 26 0"
         stroke="#ff9900"
         strokeWidth={1.8}
         strokeLinecap="round"
      />
      <path
         d="M26.5 15.8l3-1.1-.4 3.2"
         stroke="#ff9900"
         strokeWidth={1.8}
         strokeLinecap="round"
         strokeLinejoin="round"
      />
   </g>
);

export type Provider = "cloudflare" | "aws" | "server";

export const ProviderTile = ({
   x,
   y,
   provider,
   size = 24,
}: XY & { provider: Provider; size?: number }) => {
   const inner = size * 0.66;
   return (
      <g transform={`translate(${x} ${y})`}>
         <rect
            width={size}
            height={size}
            rx={size / 4}
            fill={C.white}
            stroke={C.border}
            strokeWidth={1.25}
         />
         {provider === "cloudflare" && (
            <CloudflareGlyph
               x={(size - inner) / 2}
               y={(size - inner) / 2}
               size={inner}
            />
         )}
         {provider === "aws" && (
            <AwsGlyph
               x={2}
               y={(size - (size - 4) * 0.75) / 2}
               size={size - 4}
            />
         )}
         {provider === "server" && (
            <Icon
               name="server"
               x={(size - inner) / 2}
               y={(size - inner) / 2}
               size={inner}
               color={C.text}
               sw={1.4}
            />
         )}
      </g>
   );
};

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

// renders exactly one subtree: the animated one normally, `still` under
// prefers-reduced-motion (false on the server, so SSR markup is stable).
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
}) => (
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
}) => (
   <animate
      attributeName="opacity"
      values={values}
      keyTimes={keyTimes}
      calcMode={blink ? "discrete" : undefined}
      dur={dur}
      repeatCount="indefinite"
   />
);

export const Flow = ({
   period = 20,
   dur = "1.4s",
}: {
   period?: number;
   dur?: string;
}) => (
   <animate
      attributeName="stroke-dashoffset"
      from={period}
      to={0}
      dur={dur}
      repeatCount="indefinite"
   />
);

export const FlowLine = ({
   d,
   color = C.blue,
   width = 1.5,
}: {
   d: string;
   color?: string;
   width?: number;
}) => (
   <>
      <path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" />
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

export const DashLine = ({
   d,
   color = C.light,
}: {
   d: string;
   color?: string;
}) => (
   <Motion
      still={
         <path d={d} stroke={color} strokeWidth={1.25} strokeDasharray="3 4" />
      }
   >
      <path d={d} stroke={color} strokeWidth={1.25} strokeDasharray="3 4">
         <Flow period={7} dur="1.2s" />
      </path>
   </Motion>
);

export const Caret = ({ x, y, h = 14 }: XY & { h?: number }) => (
   <Motion still={<rect x={x} y={y} width={1.5} height={h} fill={C.blue} />}>
      <rect x={x} y={y} width={1.5} height={h} fill={C.blue}>
         <Fade values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" blink />
      </rect>
   </Motion>
);
