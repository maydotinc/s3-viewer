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
      opacity: 0,
   });
   const [showTransition, setShowTransition] = React.useState(false);
   const initialRenderComplete = React.useRef(false);
   const initialTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
   );
   const listRef = React.useRef<HTMLDivElement>(null);

   const updateIndicatorPosition = React.useCallback(() => {
      if (!listRef.current) return null;
      const activeTrigger = listRef.current.querySelector(
         '[data-state="active"]'
      );
      if (activeTrigger) {
         const { offsetLeft, offsetWidth } = activeTrigger as HTMLElement;
         return { left: offsetLeft, width: offsetWidth };
      }
      return null;
   }, []);

   React.useEffect(() => {
      if (!initialRenderComplete.current) {
         setIndicatorStyle((s) => ({ ...s, left: 0, width: 0, opacity: 0 }));
      }

      const calculateInitialPosition = () => {
         const position = updateIndicatorPosition();
         if (position) {
            const newPosition = { ...position, opacity: 0 };
            setIndicatorStyle(newPosition);
            requestAnimationFrame(() => {
               requestAnimationFrame(() => {
                  setIndicatorStyle({ ...newPosition, opacity: 1 });
                  initialTimeoutRef.current = setTimeout(() => {
                     setShowTransition(true);
                     initialRenderComplete.current = true;
                  }, 10);
               });
            });
         }
      };

      if (!initialRenderComplete.current) {
         const t = setTimeout(calculateInitialPosition, 10);
         return () => {
            clearTimeout(t);
            if (initialTimeoutRef.current) {
               clearTimeout(initialTimeoutRef.current);
               initialTimeoutRef.current = null;
            }
         };
      }
   }, [value, updateIndicatorPosition]);

   React.useEffect(() => {
      if (!initialRenderComplete.current) return;
      const position = updateIndicatorPosition();
      if (position) {
         setIndicatorStyle({ ...position, opacity: 1 });
      }
   }, [value, updateIndicatorPosition]);

   React.useEffect(() => {
      const updateIndicator = () => {
         const position = updateIndicatorPosition();
         if (position && initialRenderComplete.current) {
            setIndicatorStyle({ ...position, opacity: 1 });
         }
      };

      const rafId = requestAnimationFrame(() => {
         if (initialRenderComplete.current) updateIndicator();
      });

      const observer = new MutationObserver((mutations) => {
         mutations.forEach((mutation) => {
            if (mutation.attributeName === "data-state") {
               requestAnimationFrame(updateIndicator);
            }
         });
      });

      if (listRef.current) {
         const triggers = listRef.current.querySelectorAll('[role="tab"]');
         triggers.forEach((trigger) => {
            observer.observe(trigger, { attributes: true });
         });
      }

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
   }, [value, updateIndicatorPosition]);

   return (
      <div className="relative" ref={listRef}>
         <TabsList ref={ref} className={className} {...props} />
         <div
            className={cn(
               "absolute bottom-0 h-[0.180rem] bg-viewerblue ease-in-out",
               showTransition && "transition-all duration-300"
            )}
            style={{
               left: indicatorStyle.left,
               width: indicatorStyle.width,
               opacity: indicatorStyle.opacity,
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
