import useCommandMenuStore from "@/lib/command-menu/store";
import { Button } from "@s3-viewer/ui/components/button";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { Search } from "lucide-react";

const CommandMenuTrigger = () => {
   const openMenu = useCommandMenuStore((state) => state.openMenu);

   return (
      <>
         <button
            type="button"
            onClick={openMenu}
            className="hidden h-9 w-64 cursor-pointer items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-sm text-viewerlighttext outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-viewerblue transition-colors duration-150 hover:bg-viewergray sm:flex"
         >
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Search</span>
            <Kbd keys="mod k" className="shrink-0" aria-hidden="true" />
         </button>
         <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Search"
            onClick={openMenu}
            className="sm:hidden"
         >
            <Search aria-hidden="true" />
         </Button>
      </>
   );
};

export default CommandMenuTrigger;
