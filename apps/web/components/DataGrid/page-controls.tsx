import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ChevronFirst,
   ChevronLast,
   ChevronLeft,
   ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGridContext } from "./context";

const PageControls = ({ className }: { className?: string }) => {
   const { gridReady, page, totalPages, goToPage } = useGridContext();
   const [draft, setDraft] = useState(String(page + 1));

   useEffect(() => {
      setDraft(String(page + 1));
   }, [page]);

   const lastKnown = totalPages !== null;
   const atFirst = page <= 0;
   const atLast = lastKnown && page >= totalPages - 1;
   const disabled = !gridReady;

   const commitDraft = () => {
      const parsed = Number.parseInt(draft, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
         setDraft(String(page + 1));
         return;
      }
      goToPage(lastKnown ? Math.min(parsed, totalPages) - 1 : parsed - 1);
   };

   return (
      <nav
         aria-label="Pagination"
         className={cn("flex h-9 items-center justify-center gap-1", className)}
      >
         <Button
            variant="ghost"
            size="icon"
            aria-label="First page"
            disabled={disabled || atFirst}
            onClick={() => goToPage(0)}
         >
            <ChevronFirst aria-hidden="true" />
         </Button>
         <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={disabled || atFirst}
            onClick={() => goToPage(page - 1)}
         >
            <ChevronLeft aria-hidden="true" />
         </Button>
         <label className="flex items-center gap-1.5 px-2 text-sm text-viewertext tabular-nums">
            <span>Page</span>
            <input
               type="text"
               inputMode="numeric"
               aria-label="Page number"
               value={draft}
               disabled={disabled}
               onChange={(event) => setDraft(event.target.value)}
               onBlur={commitDraft}
               onKeyDown={(event) => {
                  if (event.key === "Enter") commitDraft();
               }}
               className="h-7 w-12 rounded-md border border-viewerborder bg-viewerwhite text-center text-sm text-viewerblack outline-none focus-visible:border-viewerblue disabled:opacity-50"
            />
            {lastKnown && <span>of {totalPages}</span>}
         </label>
         <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={disabled || atLast}
            onClick={() => goToPage(page + 1)}
         >
            <ChevronRight aria-hidden="true" />
         </Button>
         <Button
            variant="ghost"
            size="icon"
            aria-label="Last page"
            disabled={disabled || !lastKnown || atLast}
            onClick={() => goToPage(totalPages ? totalPages - 1 : 0)}
         >
            <ChevronLast aria-hidden="true" />
         </Button>
      </nav>
   );
};

export default PageControls;
