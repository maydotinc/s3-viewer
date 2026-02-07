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

const TabsListWithIndicator = React.forwardRef<
   React.ElementRef<typeof TabsPrimitive.List>,
   TabsListWithIndicatorProps
>(({ className, value, ...props }, ref) => {
   const [indicatorStyle, setIndicatorStyle] = React.useState({
      left: 0,
      width: 0,
   });
   const listRef = React.useRef<HTMLDivElement>(null);

   React.useEffect(() => {
      const updateIndicator = () => {
         if (!listRef.current) return;

         // Scope the query to this specific TabsList container
         const activeTrigger = listRef.current.querySelector(
            '[data-state="active"]'
         );
         if (activeTrigger) {
            const { offsetLeft, offsetWidth } = activeTrigger as HTMLElement;
            setIndicatorStyle({ left: offsetLeft, width: offsetWidth });
         }
      };

      // Use requestAnimationFrame to ensure DOM is ready (especially important for portals/drawers)
      const rafId = requestAnimationFrame(() => {
         updateIndicator();
      });

      const observer = new MutationObserver((mutations) => {
         mutations.forEach((mutation) => {
            if (mutation.attributeName === "data-state") {
               // Use requestAnimationFrame to ensure DOM updates are complete
               requestAnimationFrame(() => {
                  updateIndicator();
               });
            }
         });
      });

      // Scope the query to this specific TabsList container
      if (listRef.current) {
         const triggers = listRef.current.querySelectorAll('[role="tab"]');
         triggers.forEach((trigger) => {
            observer.observe(trigger, { attributes: true });
         });
      }

      // Also observe the container for size changes (important for drawers/portals)
      const resizeObserver = new ResizeObserver(() => {
         updateIndicator();
      });

      if (listRef.current) {
         resizeObserver.observe(listRef.current);
      }

      return () => {
         cancelAnimationFrame(rafId);
         observer.disconnect();
         resizeObserver.disconnect();
      };
   }, [value]);

   return (
      <div className="relative" ref={listRef}>
         <TabsList ref={ref} className={className} {...props} />
         <div
            className="absolute bottom-0 h-[0.180rem] bg-viewerblue transition-all duration-300 ease-in-out"
            style={indicatorStyle}
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
         "cursor-pointer whitespace-nowrap px-0 mr-4 lg:mr-6 py-2 text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50 data-[state=active]:text-viewerdarkblue data-[state=inactive]:text-viewertext data-[state=inactive]:hover:text-viewerdarkblue",
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
      className={cn(
         "ring-offset-background focus-visible:outline-none mt-4",
         className
      )}
      {...props}
   />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsListWithIndicator as TabsList, TabsTrigger };
