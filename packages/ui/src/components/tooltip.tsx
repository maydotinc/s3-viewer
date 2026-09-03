import { cn } from "@s3-viewer/ui/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { Kbd } from "./kbd";

const TooltipProvider = ({
   delayDuration = 300,
   ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) => (
   <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
);

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

type TooltipContentProps = ComponentProps<typeof TooltipPrimitive.Content> & {
   /** Optional shortcut rendered after the label, e.g. "mod k". */
   shortcut?: string;
};

const TooltipContent = ({
   className,
   sideOffset = 6,
   shortcut,
   children,
   ...props
}: TooltipContentProps) => (
   <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
         sideOffset={sideOffset}
         className={cn(
            "z-50 flex items-center gap-2 rounded-md bg-viewerblack px-2.5 py-1.5 text-xs font-medium text-viewerwhite shadow-md",
            "data-[state=delayed-open]:animate-fade-in",
            className
         )}
         {...props}
      >
         {children}
         {shortcut && (
            <Kbd
               keys={shortcut}
               className="[&_kbd]:border-viewerwhite/20 [&_kbd]:bg-viewerwhite/10 [&_kbd]:text-viewerwhite"
            />
         )}
      </TooltipPrimitive.Content>
   </TooltipPrimitive.Portal>
);

type SimpleTooltipProps = {
   label: ReactNode;
   shortcut?: string;
   side?: TooltipContentProps["side"];
   children: ReactNode;
};

/**
 * A disabled control fires no pointer events and takes no focus, so a tooltip
 * on it would never open — and "why is this greyed out?" is exactly when the
 * label is wanted. Radix's answer is a focusable wrapper around the trigger.
 */
type MaybeDisabled = {
   disabled?: boolean;
   loading?: boolean;
   "aria-disabled"?: boolean | "true" | "false";
};

const isDisabledElement = (child: ReactNode): boolean => {
   if (!isValidElement<MaybeDisabled>(child)) return false;
   const { disabled, loading, "aria-disabled": ariaDisabled } = child.props;
   // `loading` counts: it sets the native `disabled` attribute too.
   return (
      Boolean(disabled) ||
      Boolean(loading) ||
      ariaDisabled === true ||
      ariaDisabled === "true"
   );
};

/** Wraps a single trigger element with a label (and optional shortcut). */
const SimpleTooltip = ({
   label,
   shortcut,
   side,
   children,
}: SimpleTooltipProps) => (
   <Tooltip>
      <TooltipTrigger asChild>
         {isDisabledElement(children) ? (
            <span className="inline-flex" tabIndex={0}>
               {children}
            </span>
         ) : (
            children
         )}
      </TooltipTrigger>
      <TooltipContent side={side} shortcut={shortcut}>
         {label}
      </TooltipContent>
   </Tooltip>
);

export {
   SimpleTooltip,
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
};
