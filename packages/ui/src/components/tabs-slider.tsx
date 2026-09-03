import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@s3-viewer/ui/lib/utils";
import * as React from "react";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
   React.ElementRef<typeof TabsPrimitive.List>,
   React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
   <TabsPrimitive.List
      ref={ref}
      className={cn("relative flex border-b w-fit", className)}
      {...props}
   />
));
TabsList.displayName = TabsPrimitive.List.displayName;

interface TabsListWithIndicatorProps
   extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
   value?: string;
}

type IndicatorRect = { left: number; width: number };

const useIsomorphicLayoutEffect =
   typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const TabsListWithIndicator = React.forwardRef<
   React.ElementRef<typeof TabsPrimitive.List>,
   TabsListWithIndicatorProps
>(({ className, value, ...props }, ref) => {
   const [indicator, setIndicator] = React.useState<IndicatorRect | null>(null);
   const [animate, setAnimate] = React.useState(false);
   const listRef = React.useRef<HTMLDivElement>(null);

   const measure = React.useCallback(() => {
      const activeTrigger = listRef.current?.querySelector<HTMLElement>(
         '[data-state="active"]'
      );
      if (!activeTrigger) return;

      const { offsetLeft, offsetWidth } = activeTrigger;
      setIndicator((previous) =>
         previous?.left === offsetLeft && previous?.width === offsetWidth
            ? previous
            : { left: offsetLeft, width: offsetWidth }
      );
   }, []);

   useIsomorphicLayoutEffect(() => {
      measure();
      const frame = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(frame);
   }, [measure]);

   useIsomorphicLayoutEffect(() => {
      measure();
   }, [value, measure]);

   React.useEffect(() => {
      const list = listRef.current;
      if (!list) return;

      const mutationObserver = new MutationObserver(measure);
      list.querySelectorAll('[role="tab"]').forEach((trigger) => {
         mutationObserver.observe(trigger, {
            attributes: true,
            attributeFilter: ["data-state"],
         });
      });

      const resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(list);

      return () => {
         mutationObserver.disconnect();
         resizeObserver.disconnect();
      };
   }, [measure]);

   return (
      <div className="relative" ref={listRef}>
         <TabsList ref={ref} className={className} {...props} />
         <div
            className={cn(
               "absolute bottom-0 h-[0.180rem] bg-viewerblue ease-in-out",
               animate && "transition-all duration-300"
            )}
            style={{
               left: indicator?.left ?? 0,
               width: indicator?.width ?? 0,
               opacity: indicator ? 1 : 0,
               transform: "translateY(0.5px)",
            }}
            aria-hidden="true"
         />
      </div>
   );
});
TabsListWithIndicator.displayName = "TabsListWithIndicator";

const TabsTrigger = React.forwardRef<
   React.ElementRef<typeof TabsPrimitive.Trigger>,
   React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
   <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
         "cursor-pointer whitespace-nowrap px-0 mr-4 lg:mr-6 py-2 text-sm font-medium transition-colors outline-none border-b border-transparent focus-visible:border-viewerblue disabled:opacity-50 data-[state=active]:text-viewerdarkblue data-[state=inactive]:text-viewertext data-[state=inactive]:hover:text-viewerdarkblue",
         className
      )}
      {...props}
   />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
   React.ElementRef<typeof TabsPrimitive.Content>,
   React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
   <TabsPrimitive.Content
      ref={ref}
      className={cn("focus-visible:outline-none mt-4", className)}
      {...props}
   />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsListWithIndicator as TabsList, TabsTrigger };
