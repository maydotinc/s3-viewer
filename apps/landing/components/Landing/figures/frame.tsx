import { cn } from "@s3-viewer/ui/lib/utils";
import { CSSProperties, ReactNode, useEffect, useRef } from "react";

type Size = { width: number; height: number };

type NarrowAt = "sm" | "lg";

type ScaledFrameProps = Size & {
   narrow?: Size;
   narrowAt?: NarrowAt;
   label: string;
   className?: string;
   children: ReactNode;
};

const TRIG = "scale(tan(atan2(1px, 1px)))";

const NARROW_AT: Record<NarrowAt, string> = {
   lg: "@max-lg/frame:[--frame-h:var(--frame-narrow-h)] @max-lg/frame:[--frame-w:var(--frame-narrow-w)]",
   sm: "@max-sm/frame:[--frame-h:var(--frame-narrow-h)] @max-sm/frame:[--frame-w:var(--frame-narrow-w)]",
};

// the design is laid out at a fixed pixel size and scaled to the container
// width. below the `frame` container's `narrowAt` size it switches to the
// `narrow` size, so children can drop columns (`@max-lg/frame:` variants) and
// phones get a larger scale. CSS trig divides lengths without reflow;
// ResizeObserver covers older browsers.
export const ScaledFrame = ({
   width,
   height,
   narrow = { width, height },
   narrowAt = "lg",
   label,
   className,
   children,
}: ScaledFrameProps) => {
   const ref = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (CSS.supports("transform", TRIG)) return;
      const outer = ref.current;
      const inner = outer?.firstElementChild;
      if (!outer || !(inner instanceof HTMLElement)) return;
      const observer = new ResizeObserver(([entry]) => {
         if (!entry) return;
         inner.style.transform = `scale(${entry.contentRect.width / inner.offsetWidth})`;
      });
      observer.observe(outer);
      return () => observer.disconnect();
   }, []);

   return (
      <div className={cn("@container/frame relative w-full", className)}>
         <div
            ref={ref}
            role="img"
            aria-label={label}
            className={cn(
               "@container relative w-full overflow-hidden select-none [--frame-h:var(--frame-wide-h)] [--frame-w:var(--frame-wide-w)]",
               NARROW_AT[narrowAt]
            )}
            style={
               {
                  "--frame-wide-w": width,
                  "--frame-wide-h": height,
                  "--frame-narrow-w": narrow.width,
                  "--frame-narrow-h": narrow.height,
                  aspectRatio: "var(--frame-w) / var(--frame-h)",
               } as CSSProperties
            }
         >
            <div
               aria-hidden
               className="absolute top-0 left-0 origin-top-left"
               style={{
                  width: "calc(var(--frame-w) * 1px)",
                  height: "calc(var(--frame-h) * 1px)",
                  transform:
                     "scale(tan(atan2(100cqw, calc(var(--frame-w) * 1px))))",
               }}
            >
               {children}
            </div>
         </div>
      </div>
   );
};
