import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

// underline tabs (DESIGN.md §4 "Tabs"): a 2px underline slides between items;
// hover is a static gray fill on the item itself. The underline is measured
// before the first paint, so a fresh page shows it in place with no fade.
// `TabLink` is for routes, `TabButton` for state.

type Rect = { left: number; width: number };

type TabListContextValue = {
   // returns the matching unregister
   register: (element: HTMLElement, active: boolean) => () => void;
};

const TabListContext = React.createContext<TabListContextValue | null>(null);

const useTabListContext = (): TabListContextValue => {
   const context = React.useContext(TabListContext);
   if (!context) throw new Error("Tab items must be rendered inside TabList");
   return context;
};

// layout effects warn during ssr; the server renders no underline anyway
const useIsomorphicLayoutEffect =
   typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const measure = (list: HTMLElement, element: HTMLElement): Rect => {
   const listRect = list.getBoundingClientRect();
   const rect = element.getBoundingClientRect();
   return { left: rect.left - listRect.left, width: rect.width };
};

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

function TabList({
   className,
   children,
   ...props
}: React.ComponentProps<"div">) {
   const listRef = React.useRef<HTMLDivElement>(null);
   const activeRef = React.useRef<HTMLElement | null>(null);
   const [active, setActive] = React.useState<Rect | null>(null);
   // the slide is enabled only after the first measurement has painted, so
   // the underline of a freshly loaded page never animates into place
   const [settled, setSettled] = React.useState(false);

   const measureActive = React.useCallback(() => {
      const list = listRef.current;
      const element = activeRef.current;
      setActive(list && element ? measure(list, element) : null);
   }, []);

   // observes the list and every item, so the underline follows the active
   // label when any label's width changes after mount (a count arriving on an
   // earlier tab moves the active one, a font swap resizes it).
   const observerRef = React.useRef<ResizeObserver | null>(null);
   const itemsRef = React.useRef(new Set<HTMLElement>());

   React.useEffect(() => {
      const list = listRef.current;
      if (!list) return;
      const observer = new ResizeObserver(measureActive);
      observerRef.current = observer;
      observer.observe(list);
      itemsRef.current.forEach((item) => observer.observe(item));
      return () => {
         observer.disconnect();
         observerRef.current = null;
      };
   }, [measureActive]);

   React.useEffect(() => {
      // a hidden tab measures zero; wait for a real width before enabling the slide
      if (active && active.width > 0 && !settled) setSettled(true);
   }, [active, settled]);

   const context = React.useMemo<TabListContextValue>(
      () => ({
         register: (element, isActive) => {
            itemsRef.current.add(element);
            observerRef.current?.observe(element);
            if (isActive) {
               activeRef.current = element;
               measureActive();
            }
            return () => {
               itemsRef.current.delete(element);
               observerRef.current?.unobserve(element);
               if (activeRef.current === element) {
                  activeRef.current = null;
                  measureActive();
               }
            };
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
            onKeyDown={moveFocus}
            {...props}
         >
            <span
               aria-hidden="true"
               className={cn(
                  "pointer-events-none absolute -bottom-px left-0 h-0.5 bg-viewerblack",
                  settled &&
                     "motion-safe:transition-[transform,width] motion-safe:duration-200 motion-safe:ease-out"
               )}
               style={{
                  transform: `translateX(${active?.left ?? 0}px)`,
                  width: active?.width ?? 0,
                  opacity: active ? 1 : 0,
               }}
            />
            {children}
         </div>
      </TabListContext.Provider>
   );
}

// the item fills the row's height so the whole strip is a target; the fill
// inside it is what the pointer highlights, inset from the hairline
const ITEM =
   "group relative z-10 inline-flex h-10 shrink-0 cursor-pointer items-center outline-none select-none";

const FILL =
   "flex h-7 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 group-hover:bg-viewergray group-focus-visible:bg-viewergray";

type TabItemProps = {
   active: boolean;
   count?: number;
   children: React.ReactNode;
};

const TabLabel = ({ active, count, children }: TabItemProps) => (
   <span
      className={cn(
         FILL,
         active
            ? "text-viewerblack"
            : "text-viewertext group-hover:text-viewerblack"
      )}
   >
      <span>{children}</span>
      {count !== undefined && (
         <span className="text-xs text-viewerlighttext tabular-nums">
            {count}
         </span>
      )}
   </span>
);

const useTabItem = (active: boolean) => {
   const { register } = useTabListContext();
   const ref = React.useRef<HTMLElement | null>(null);

   useIsomorphicLayoutEffect(() => {
      const element = ref.current;
      if (!element) return;
      return register(element, active);
   }, [active, register]);

   return ref;
};

// wraps a link (`asChild` with next/link) so the route decides what is active
function TabLink({
   active,
   count,
   className,
   children,
   ...props
}: TabItemProps & Omit<React.ComponentProps<"a">, "children">) {
   const ref = useTabItem(active);
   return (
      <Slot
         ref={ref as React.Ref<HTMLAnchorElement>}
         data-slot="tab-link"
         data-state={active ? "active" : "inactive"}
         aria-current={active ? "page" : undefined}
         className={cn(ITEM, className)}
         {...props}
      >
         {React.isValidElement<{ children?: React.ReactNode }>(children)
            ? React.cloneElement(
                 children,
                 undefined,
                 <TabLabel active={active} count={count}>
                    {children.props.children}
                 </TabLabel>
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
   const ref = useTabItem(active);
   return (
      <button
         ref={ref as React.Ref<HTMLButtonElement>}
         type="button"
         role="tab"
         data-slot="tab-button"
         data-state={active ? "active" : "inactive"}
         aria-selected={active}
         className={cn(ITEM, className)}
         {...props}
      >
         <TabLabel active={active} count={count}>
            {children}
         </TabLabel>
      </button>
   );
}

export { TabButton, TabLink, TabList };
