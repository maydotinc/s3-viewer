import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronDown, Folder, X } from "lucide-react";
import { FigureCheckbox } from "./figure-checkbox";
import { ScaledFrame } from "./frame";

const SELECT =
   "flex h-8 items-center justify-between gap-2 rounded-md border border-viewerborder bg-viewerwhite px-2.5 text-sm text-viewerblack";

const FolderChip = ({ children }: { children: string }) => (
   <span className="flex items-center gap-1 rounded-md bg-viewergray py-0.5 pr-1 pl-2 text-xs text-viewerblack">
      <Folder className="size-3 shrink-0 text-viewerblue" />
      {children}
      <X className="size-3 shrink-0 text-viewerlighttext" />
   </span>
);

export const FolderAccessFigure = () => (
   <ScaledFrame
      width={480}
      height={360}
      narrow={{ width: 380, height: 330 }}
      narrowAt="sm"
      label="The bucket access picker in S3 Viewer: an Editor on company-assets limited to the landing folder, with the other buckets left unshared"
   >
      <div className="grid size-full cursor-default place-items-center">
         <div className="w-[360px] rounded-xl border border-viewerborder bg-viewerwhite p-4 shadow-sm">
            <p className="text-sm font-medium text-viewerblack">
               Bucket access
            </p>
            <p className="mt-0.5 text-xs text-viewerlighttext">
               contractor@example.com
            </p>

            <div className="mt-3 flex items-center gap-3">
               <FigureCheckbox checked />
               <span className="min-w-0 flex-1 truncate text-sm text-viewerblack">
                  company-assets
               </span>
               <span className={cn(SELECT, "w-28")}>
                  Editor
                  <ChevronDown className="size-3.5 text-viewerlighttext" />
               </span>
            </div>
            <div className="mt-2 flex flex-col gap-2 pl-7">
               <span className={cn(SELECT, "w-40")}>
                  Specific folders
                  <ChevronDown className="size-3.5 text-viewerlighttext" />
               </span>
               <div className="flex flex-wrap gap-1.5">
                  <FolderChip>landing/</FolderChip>
               </div>
            </div>

            <div className="mt-3 flex flex-col divide-y divide-viewerborder border-t border-viewerborder">
               {["user-uploads", "internal"].map((bucket) => (
                  <div key={bucket} className="flex h-10 items-center gap-3">
                     <FigureCheckbox />
                     <span className="min-w-0 flex-1 truncate text-sm text-viewerlighttext">
                        {bucket}
                     </span>
                  </div>
               ))}
            </div>
         </div>
      </div>
   </ScaledFrame>
);
