import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Check } from "lucide-react";
import { Fragment, memo } from "react";
import { STEP_LABELS, type StepId } from "./wizard-text";

type StepperProps = {
   steps: readonly StepId[];
   current: StepId;
   // after sending every step is done and none can be revisited
   finished: boolean;
   loading: boolean;
   onSelect: (step: StepId) => void;
};

const ROW = "flex h-9 items-center gap-2";

const CIRCLE =
   "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums";

const StepperSkeleton = () => (
   <div className={ROW} aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
         <Fragment key={index}>
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3.5 w-16" />
            {index < 3 && <Skeleton className="h-px min-w-4 flex-1" />}
         </Fragment>
      ))}
   </div>
);

const Stepper = memo(function Stepper({
   steps,
   current,
   finished,
   loading,
   onSelect,
}: StepperProps) {
   if (loading) return <StepperSkeleton />;
   const currentIndex = steps.indexOf(current);
   return (
      <ol aria-label="Invite steps" className={ROW}>
         {steps.map((step, index) => {
            const done = finished || index < currentIndex;
            const active = !finished && index === currentIndex;
            const label = (
               <span
                  className={cn(
                     "text-sm whitespace-nowrap",
                     active
                        ? "font-medium text-viewerblack"
                        : done
                          ? "text-viewertext group-hover:text-viewerblack"
                          : "text-viewerlighttext",
                     !active && "sr-only sm:not-sr-only"
                  )}
               >
                  {STEP_LABELS[step]}
               </span>
            );
            const circle = (
               <span
                  className={cn(
                     CIRCLE,
                     done && "border-viewerblue bg-viewerblue text-viewerwhite",
                     active &&
                        "border-viewerblue bg-viewerwhite text-viewerblue",
                     !done &&
                        !active &&
                        "border-viewerborder text-viewerlighttext"
                  )}
               >
                  {done ? (
                     <Check aria-hidden="true" className="size-3.5" />
                  ) : (
                     index + 1
                  )}
               </span>
            );
            return (
               <Fragment key={step}>
                  <li
                     aria-current={active ? "step" : undefined}
                     className="flex shrink-0 items-center"
                  >
                     {done && !finished ? (
                        <button
                           type="button"
                           onClick={() => onSelect(step)}
                           className={cn(
                              "group flex cursor-pointer items-center gap-2 rounded-md outline-none",
                              FOCUS_RING,
                              "focus-visible:-outline-offset-2"
                           )}
                        >
                           {circle}
                           {label}
                        </button>
                     ) : (
                        <span className="flex items-center gap-2">
                           {circle}
                           {label}
                        </span>
                     )}
                  </li>
                  {index < steps.length - 1 && (
                     <li
                        aria-hidden="true"
                        className={cn(
                           "h-px min-w-4 flex-1",
                           done ? "bg-viewerblue" : "bg-viewerborder"
                        )}
                     />
                  )}
               </Fragment>
            );
         })}
      </ol>
   );
});

export default Stepper;
