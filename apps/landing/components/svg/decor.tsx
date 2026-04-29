import { cn } from "@s3-viewer/ui/lib/utils";

type DecorProps = {
   className?: string;
   "aria-hidden"?: boolean;
};

export const OrbitDecor = ({ className }: DecorProps) => (
   <svg
      viewBox="0 0 360 360"
      fill="none"
      stroke="currentColor"
      aria-hidden
      className={cn("pointer-events-none", className)}
   >
      <g className="motion-orbit">
         <circle cx="180" cy="180" r="60" strokeWidth="1" opacity="0.3" />
         <circle cx="180" cy="180" r="110" strokeWidth="1" opacity="0.2" />
         <circle cx="180" cy="180" r="160" strokeWidth="1" opacity="0.12" />
         <circle cx="180" cy="60" r="3" fill="currentColor" />
      </g>
   </svg>
);

export const GridDecor = ({ className }: DecorProps) => (
   <svg
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
      className={cn("pointer-events-none", className)}
   >
      <defs>
         <pattern
            id="decor-grid"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
         >
            <path
               d="M 20 0 L 0 0 0 20"
               fill="none"
               stroke="currentColor"
               strokeWidth="0.5"
               opacity="0.3"
            />
         </pattern>
      </defs>
      <rect width="200" height="200" fill="url(#decor-grid)" />
   </svg>
);

export const BucketGlyph = ({ className }: DecorProps) => (
   <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      className={cn("pointer-events-none", className)}
   >
      <path
         className="motion-stroke-draw"
         style={{ "--motion-dash": 220 } as React.CSSProperties}
         d="M14 18h36l-3 30a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4l-3-30Z"
         strokeLinejoin="round"
      />
      <path
         className="motion-stroke-draw motion-delay-150"
         style={{ "--motion-dash": 80 } as React.CSSProperties}
         d="M22 18a10 10 0 0 1 20 0"
         strokeLinecap="round"
      />
      <circle cx="32" cy="36" r="3" fill="currentColor" stroke="none" />
   </svg>
);

export const PulseDot = ({ className }: DecorProps) => (
   <span
      aria-hidden
      className={cn(
         "relative inline-flex size-2 items-center justify-center",
         className
      )}
   >
      <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-50 motion-float" />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
   </span>
);
