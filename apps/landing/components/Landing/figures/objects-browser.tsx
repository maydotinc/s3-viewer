import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ArrowLeft,
   Check,
   ChevronDown,
   EllipsisVertical,
   Plus,
   RefreshCw,
   Search,
   UserPlus,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { ScaledFrame } from "./frame";
import { useToday } from "./use-today";

type FileRow = { name: string; size: string };

const ROOT_FILES: FileRow[] = [
   { name: "animated.gif", size: "1.88 MB" },
   { name: "clip.mp4", size: "15.95 MB" },
   { name: "compressed.zip", size: "487.53 KB" },
   { name: "export.mp4", size: "80.25 MB" },
   { name: "image.png", size: "93.03 KB" },
   { name: "laughing.gif", size: "122.3 KB" },
   { name: "mountains.png", size: "11.4 KB" },
   { name: "program.exe", size: "1.29 MB" },
   { name: "recording.mp4", size: "150.34 MB" },
];

const BACKUP_FILES: FileRow[] = [
   { name: "db-2026-09-01.sql.gz", size: "412 MB" },
   { name: "db-2026-09-02.sql.gz", size: "415 MB" },
   { name: "db-2026-09-03.sql.gz", size: "419 MB" },
];

const FOLDER = "backup/";

const GRID = "grid grid-cols-[40px_448px_227px_1fr_40px] items-center";
const CELL = "min-w-0 truncate pr-4";
const LINK =
   "inline-flex cursor-pointer items-center gap-1.5 text-sm text-viewerblue underline underline-offset-4 hover:text-viewerdarkblue";

const FigureCheckbox = ({
   checked,
   onToggle,
}: {
   checked: boolean;
   onToggle: () => void;
}) => (
   <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      className="grid size-8 cursor-pointer place-items-center justify-self-center"
   >
      <span
         className={cn(
            "grid size-4 place-items-center rounded-[4px] border transition-colors duration-150",
            checked
               ? "border-viewerblue bg-viewerblue"
               : "border-viewerborder bg-viewerwhite"
         )}
      >
         {checked && <Check className="size-3 text-viewerwhite" />}
      </span>
   </button>
);

const Row = ({
   className,
   children,
}: {
   className?: string;
   children: ReactNode;
}) => (
   <div
      className={cn(
         GRID,
         "h-11 border-b border-viewerborder transition-colors duration-150",
         className
      )}
   >
      {children}
   </div>
);

export const ObjectsBrowserFigure = () => {
   const today = useToday();
   const [dir, setDir] = useState<"root" | "backup">("root");
   const [query, setQuery] = useState("");
   const [selected, setSelected] = useState<string[]>([]);
   const [spin, setSpin] = useState(0);

   useEffect(() => {
      if (!spin) return;
      const id = window.setTimeout(() => setSpin(0), 600);
      return () => window.clearTimeout(id);
   }, [spin]);

   const q = query.trim().toLowerCase();
   const files = (dir === "root" ? ROOT_FILES : BACKUP_FILES).filter((f) =>
      f.name.toLowerCase().includes(q)
   );
   const showFolder = dir === "root" && FOLDER.includes(q);
   const showBack = dir === "backup";
   const empty = files.length === 0;
   const visible = files.map((f) => f.name);
   const visibleSelected = selected.filter((n) => visible.includes(n));
   const allSelected = !empty && visibleSelected.length === visible.length;

   const navigate = (next: "root" | "backup") => {
      setDir(next);
      setQuery("");
      setSelected([]);
   };

   const toggle = (name: string) =>
      setSelected((prev) =>
         prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
      );

   const toggleAll = () =>
      setSelected((prev) =>
         allSelected
            ? prev.filter((n) => !visible.includes(n))
            : [...new Set([...prev, ...visible])]
      );

   return (
      <ScaledFrame
         width={1104}
         height={562}
         label="Browsing objects inside a bucket in S3 Viewer: a folder and nine files with sizes and modified dates"
      >
         <div className="flex h-full cursor-default flex-col p-6 pb-0 text-sm">
            <div className="flex h-9 shrink-0 items-center gap-2">
               <label className="relative w-72">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-viewerlighttext" />
                  <input
                     tabIndex={-1}
                     aria-label="Search objects"
                     placeholder="Search..."
                     value={query}
                     onChange={(e) => setQuery(e.target.value)}
                     className="h-9 w-full rounded-lg border border-viewerborder bg-viewerwhite pr-3 pl-9 text-sm text-viewerblack outline-none placeholder:text-viewerlighttext focus-visible:border-viewerblue pointer-coarse:pointer-events-none"
                  />
               </label>
               <Button variant="outline" type="button" tabIndex={-1}>
                  Rows (100)
                  <ChevronDown />
               </Button>
               <span
                  className={cn(
                     "px-2 text-sm text-viewertext tabular-nums",
                     visibleSelected.length === 0 && "invisible"
                  )}
               >
                  {visibleSelected.length} selected
               </span>
               <div className="ml-auto flex items-center gap-2">
                  <Button
                     variant="outline"
                     type="button"
                     tabIndex={-1}
                     onClick={() => setSpin((n) => n + 1)}
                  >
                     <RefreshCw
                        className={cn(
                           spin > 0 && "animate-spin motion-reduce:animate-none"
                        )}
                     />
                     Refresh
                  </Button>
                  <Button variant="outline" type="button" tabIndex={-1}>
                     <UserPlus />
                     Share
                  </Button>
                  <Button type="button" tabIndex={-1}>
                     <Plus />
                     New
                  </Button>
               </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-t-lg">
               <div
                  className={cn(
                     GRID,
                     "h-11 bg-viewergray/60 text-[13px] font-medium text-viewertext"
                  )}
               >
                  <FigureCheckbox checked={allSelected} onToggle={toggleAll} />
                  <span className={CELL}>Name</span>
                  <span className={CELL}>Size</span>
                  <span className={CELL}>Modified</span>
                  <span />
               </div>

               {showFolder && (
                  <Row className="hover:bg-viewergray/60">
                     <span />
                     <span className={CELL}>
                        <button
                           type="button"
                           tabIndex={-1}
                           onClick={() => navigate("backup")}
                           className={LINK}
                        >
                           {FOLDER}
                        </button>
                     </span>
                  </Row>
               )}

               {showBack && (
                  <Row className="hover:bg-viewergray/60">
                     <span />
                     <span className={CELL}>
                        <button
                           type="button"
                           tabIndex={-1}
                           onClick={() => navigate("root")}
                           className={LINK}
                        >
                           <ArrowLeft className="size-4" />
                           {FOLDER}
                        </button>
                     </span>
                  </Row>
               )}

               {empty && !showFolder && (
                  <Row>
                     <span />
                     <span className={cn(CELL, "text-viewerlighttext")}>
                        No objects match
                     </span>
                  </Row>
               )}

               {files.map((file) => {
                  const isSelected = selected.includes(file.name);
                  return (
                     <Row
                        key={file.name}
                        className={cn(
                           "text-viewerblack",
                           isSelected
                              ? "bg-viewerblue/5"
                              : "hover:bg-viewergray/60"
                        )}
                     >
                        <FigureCheckbox
                           checked={isSelected}
                           onToggle={() => toggle(file.name)}
                        />
                        <span className={CELL}>{file.name}</span>
                        <span className={cn(CELL, "tabular-nums")}>
                           {file.size}
                        </span>
                        <span className={CELL}>
                           <span className="inline-block w-[10ch] tabular-nums">
                              {today}
                           </span>
                        </span>
                        <Button
                           variant="ghost"
                           size="icon-sm"
                           type="button"
                           tabIndex={-1}
                           className="justify-self-center text-viewertext"
                        >
                           <EllipsisVertical />
                        </Button>
                     </Row>
                  );
               })}
            </div>
         </div>
      </ScaledFrame>
   );
};
