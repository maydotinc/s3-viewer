import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

// underline tabs (DESIGN.md §4 "Tabs"): a hover pill and an active underline
// both slide between items. `TabLink` is for routes, `TabButton` for state.

type Rect = { left: number; width: number };

type TabListContextValue = {
   register: (element: HTMLElement | null, active: boolean) => void;
   setHovered: (element: HTMLElement | null) => void;
};

const TabListContext = React.createContext<TabListContextValue | null>(null);

const useTabListContext = (): TabListContextValue => {
   const context = React.useContext(TabListContext);
   if (!context) throw new Error("Tab items must be rendered inside TabList");
   return context;
};

const measure = (list: HTMLElement, element: HTMLElement): Rect => {
   const listRect = list.getBoundingClientRect();
   const rect = element.getBoundingClientRect();
   return { left: rect.left - listRect.left, width: rect.width };
};

const indicatorStyle = (rect: Rect | null): React.CSSProperties => ({
   transform: `translateX(${rect?.left ?? 0}px)`,
   width: rect?.width ?? 0,
   opacity: rect ? 1 : 0,
});

// ←/→/Home/End move between `role="tab"` items and activate the target, the
// automatic-activation tablist pattern; link tabs are plain links and skip it.
const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
   const target = event.target;
   if (
      !(target instanceof HTMLElement) ||
      target.getAttribute("role") !== "tab"
   )
      return;
   const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')
   );
   const index = tabs.indexOf(target);
   const next =
      event.key === "ArrowRight"
         ? tabs[(index + 1) % tabs.length]
         : event.key === "ArrowLeft"
           ? tabs[(index - 1 + tabs.length) % tabs.length]
           : event.key === "Home"
             ? tabs[0]
             : event.key === "End"
               ? tabs[tabs.length - 1]
               : undefined;
   if (!next) return;
   event.preventDefault();
   next.focus();
   next.click();
};

const INDICATOR =
   "pointer-events-none absolute left-0 motion-safe:transition-[transform,width,opacity] motion-safe:duration-200 motion-safe:ease-out";

function TabList({
   className,
   children,
   ...props
}: React.ComponentProps<"div">) {
   const listRef = React.useRef<HTMLDivElement>(null);
   const activeRef = React.useRef<HTMLElement | null>(null);
   const [active, setActive] = React.useState<Rect | null>(null);
   const [hover, setHover] = React.useState<Rect | null>(null);
   // the pill fades out in place rather than sliding back to zero width
   const [hoverVisible, setHoverVisible] = React.useState(false);

   const measureActive = React.useCallback(() => {
      const list = listRef.current;
      const element = activeRef.current;
      setActive(list && element ? measure(list, element) : null);
   }, []);

   // observes the list and the active item, so the underline follows a label
   // whose width changes after mount (a count arriving, a font swap).
   const observerRef = React.useRef<ResizeObserver | null>(null);

   React.useEffect(() => {
      const list = listRef.current;
      if (!list) return;
      const observer = new ResizeObserver(measureActive);
      observerRef.current = observer;
      observer.observe(list);
      if (activeRef.current) observer.observe(activeRef.current);
      return () => {
         observer.disconnect();
         observerRef.current = null;
      };
   }, [measureActive]);

   const context = React.useMemo<TabListContextValue>(
      () => ({
         register: (element, isActive) => {
            const previous = activeRef.current;
            if (isActive) {
               activeRef.current = element;
            } else if (previous === element) {
               activeRef.current = null;
            } else {
               return;
            }
            if (previous && previous !== activeRef.current) {
               observerRef.current?.unobserve(previous);
            }
            if (activeRef.current)
               observerRef.current?.observe(activeRef.current);
            measureActive();
         },
         setHovered: (element) => {
            const list = listRef.current;
            if (!list || !element) {
               setHoverVisible(false);
               return;
            }
            setHover(measure(list, element));
            setHoverVisible(true);
         },
      }),
      [measureActive]
   );

   return (
      <TabListContext.Provider value={context}>
         <div
            ref={listRef}
            data-slot="tab-list"
            className={cn(
               "relative flex h-10 w-full items-stretch border-b border-viewerborder",
               className
            )}
            onMouseLeave={() => setHoverVisible(false)}
            onKeyDown={moveFocus}
            {...props}
         >
            <span
               aria-hidden="true"
               className={cn(INDICATOR, "inset-y-1.5 rounded-md bg-viewergray")}
               style={{
                  ...indicatorStyle(hover),
                  opacity: hoverVisible && hover ? 1 : 0,
               }}
            />
            <span
               aria-hidden="true"
               className={cn(INDICATOR, "-bottom-px h-0.5 bg-viewerblack")}
               style={indicatorStyle(active)}
            />
            {children}
         </div>
      </TabListContext.Provider>
   );
}

const ITEM =
   "relative z-10 inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-150 select-none";

type TabItemProps = {
   active: boolean;
   count?: number;
   children: React.ReactNode;
};

const TabLabel = ({ count, children }: Omit<TabItemProps, "active">) => (
   <>
      <span>{children}</span>
      {count !== undefined && (
         <span className="text-xs text-viewerlighttext tabular-nums">
            {count}
         </span>
      )}
   </>
);

const useTabItem = (active: boolean) => {
   const { register, setHovered } = useTabListContext();
   const ref = React.useRef<HTMLElement | null>(null);

   React.useEffect(() => {
      const element = ref.current;
      register(element, active);
      return () => register(element, false);
   }, [active, register]);

   return {
      ref,
      className: cn(
         ITEM,
         active ? "text-viewerblack" : "text-viewertext hover:text-viewerblack"
      ),
      onPointerEnter: (event: React.PointerEvent<HTMLElement>) =>
         setHovered(event.currentTarget),
      onFocus: (event: React.FocusEvent<HTMLElement>) =>
         setHovered(event.currentTarget),
      onBlur: () => setHovered(null),
   };
};

// wraps a link (`asChild` with next/link) so the route decides what is active
function TabLink({
   active,
   count,
   className,
   children,
   ...props
}: TabItemProps & Omit<React.ComponentProps<"a">, "children">) {
   const item = useTabItem(active);
   return (
      <Slot
         ref={item.ref as React.Ref<HTMLAnchorElement>}
         data-slot="tab-link"
         data-state={active ? "active" : "inactive"}
         aria-current={active ? "page" : undefined}
         className={cn(item.className, className)}
         onPointerEnter={item.onPointerEnter}
         onFocus={item.onFocus}
         onBlur={item.onBlur}
         {...props}
      >
         {React.isValidElement<{ children?: React.ReactNode }>(children)
            ? React.cloneElement(
                 children,
                 undefined,
                 <TabLabel count={count}>{children.props.children}</TabLabel>
              )
            : children}
      </Slot>
   );
}

function TabButton({
   active,
   count,
   className,
   children,
   ...props
}: TabItemProps & Omit<React.ComponentProps<"button">, "children">) {
   const item = useTabItem(active);
   return (
      <button
         ref={item.ref as React.Ref<HTMLButtonElement>}
         type="button"
         role="tab"
         data-slot="tab-button"
         data-state={active ? "active" : "inactive"}
         aria-selected={active}
         className={cn(item.className, className)}
         onPointerEnter={item.onPointerEnter}
         onFocus={item.onFocus}
         onBlur={item.onBlur}
         {...props}
      >
         <TabLabel count={count}>{children}</TabLabel>
      </button>
   );
}

export { TabButton, TabLink, TabList };
