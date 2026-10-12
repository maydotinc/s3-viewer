import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Pause, Play } from "lucide-react";

const MotionToggle = ({
   paused,
   onToggle,
   className,
}: {
   paused: boolean;
   onToggle: () => void;
   className?: string;
}) => {
   const reduced = useReducedMotion();
   if (reduced) return null;
   return (
      <button
         type="button"
         onClick={onToggle}
         aria-pressed={paused}
         aria-label="Pause animation"
         title={paused ? "Play animation" : "Pause animation"}
         className={cn(
            "absolute right-2 bottom-2 z-10 grid size-8 cursor-pointer place-items-center rounded-md border border-viewerborder bg-viewerwhite/90 text-viewertext transition-colors hover:text-viewerblack outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-viewerblue motion-reduce:transition-none",
            className
         )}
      >
         {paused ? (
            <Play className="size-3.5" aria-hidden />
         ) : (
            <Pause className="size-3.5" aria-hidden />
         )}
      </button>
   );
};

export default MotionToggle;
