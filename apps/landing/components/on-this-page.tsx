import { Eyebrow } from "@/components/basic-block";
import { useActiveSection } from "@/lib/hooks/use-active-section";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

type OnThisPageItem = { id: string; title: string };

const OnThisPage = ({ items }: { items: readonly OnThisPageItem[] }) => {
   const ids = useMemo(() => items.map((item) => item.id), [items]);
   const activeId = useActiveSection(ids);

   return (
      <>
         <details className="group rounded-xl border border-viewerborder bg-viewerwhite lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-semibold text-viewerblack">
               On this page
               <ChevronRight
                  className="size-4 flex-none text-viewertext transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  aria-hidden
               />
            </summary>
            <nav
               aria-label="On this page"
               className="flex flex-col border-t border-viewerborder p-2"
            >
               {items.map((item) => (
                  <a
                     key={item.id}
                     href={`#${item.id}`}
                     className="rounded-md px-2 py-2.5 text-sm text-viewertext transition-colors hover:bg-viewergray hover:text-viewerblack"
                  >
                     {item.title}
                  </a>
               ))}
            </nav>
         </details>

         <aside className="hidden lg:block">
            <div className="sticky top-28 flex max-h-[calc(100svh-8rem)] flex-col gap-3 overflow-y-auto">
               <Eyebrow>On this page</Eyebrow>
               <nav
                  aria-label="On this page"
                  className="relative flex flex-col"
               >
                  <span
                     aria-hidden
                     className="absolute left-0 top-0 bottom-0 w-px bg-viewerborder"
                  />
                  {items.map((item) => {
                     const isActive = activeId === item.id;
                     return (
                        <a
                           key={item.id}
                           href={`#${item.id}`}
                           aria-current={isActive ? "location" : undefined}
                           className={cn(
                              "relative pl-4 pr-2 py-2 text-sm font-semibold leading-snug transition-colors",
                              isActive
                                 ? "text-viewerblue"
                                 : "text-viewertext hover:text-viewerblack"
                           )}
                        >
                           {isActive && (
                              <span
                                 aria-hidden
                                 className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-viewerblue"
                              />
                           )}
                           {item.title}
                        </a>
                     );
                  })}
               </nav>
            </div>
         </aside>
      </>
   );
};

export default OnThisPage;
