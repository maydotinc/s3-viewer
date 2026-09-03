import { fromFileList } from "@/lib/utils/s3/dropEntries";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { ChevronDown, FilePlus, FolderPlus, Upload } from "lucide-react";
import { useRef } from "react";
import { useUploader } from "./provider";

type UploadMode = "files" | "folder";

const MODES: readonly UploadMode[] = ["files", "folder"];

const MODE_LABEL: Record<UploadMode, string> = {
   files: "Upload files",
   folder: "Upload folder",
};

const MODE_ICON: Record<UploadMode, typeof FilePlus> = {
   files: FilePlus,
   folder: FolderPlus,
};

const FOLDER_INPUT_ATTRS = { webkitdirectory: "" } as const;

const UploadMenu = ({ className }: { className?: string }) => {
   const { upload, isChecking } = useUploader();
   const inputs = useRef<Partial<Record<UploadMode, HTMLInputElement | null>>>(
      {}
   );

   return (
      <>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button
                  variant="secondary"
                  loading={isChecking}
                  className={className}
               >
                  {!isChecking && <Upload aria-hidden="true" />}
                  {isChecking ? "Checking…" : "Upload"}
                  <ChevronDown aria-hidden="true" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
               {MODES.map((mode) => {
                  const Icon = MODE_ICON[mode];
                  return (
                     <DropdownMenuItem
                        key={mode}
                        onSelect={() => inputs.current[mode]?.click()}
                     >
                        <Icon aria-hidden="true" />
                        {MODE_LABEL[mode]}
                     </DropdownMenuItem>
                  );
               })}
            </DropdownMenuContent>
         </DropdownMenu>
         {MODES.map((mode) => (
            <input
               key={mode}
               ref={(element) => {
                  inputs.current[mode] = element;
               }}
               type="file"
               multiple
               hidden
               tabIndex={-1}
               aria-hidden="true"
               {...(mode === "folder" ? FOLDER_INPUT_ATTRS : {})}
               onChange={(event) => {
                  const files = event.target.files;
                  if (files && files.length > 0)
                     void upload(fromFileList(files));
                  event.target.value = "";
               }}
            />
         ))}
      </>
   );
};

export default UploadMenu;
