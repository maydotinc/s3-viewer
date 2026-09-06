import { cn } from "@s3-viewer/ui/lib/utils";
import { ReactNode, useEffect, useRef } from "react";

type ScaledFrameProps = {
   width: number;
   height: number;
   label: string;
   className?: string;
   children: ReactNode;
};

const TRIG = "scale(tan(atan2(1px, 1px)))";

// renders `children` at a fixed base size and scales the whole thing to the
// container width, so a ui replica behaves exactly like an image: its box is
// aspect-ratio only, its content never reflows. css trig does the division;
// a resize observer covers browsers without it.
export const ScaledFrame = ({
   width,
   height,
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
         inner.style.transform = `scale(${entry.contentRect.width / width})`;
      });
      observer.observe(outer);
      return () => observer.disconnect();
   }, [width]);

   return (
      <div className={cn("relative w-full", className)}>
         <div
            ref={ref}
            role="group"
            aria-label={label}
            className="@container relative w-full overflow-hidden select-none"
            style={{ aspectRatio: `${width} / ${height}` }}
         >
            <div
               className="absolute top-0 left-0 origin-top-left"
               style={{
                  width,
                  height,
                  transform: `scale(tan(atan2(100cqw, ${width}px)))`,
               }}
            >
               {children}
            </div>
         </div>
      </div>
   );
};
