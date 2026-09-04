import { useShortcut } from "@/lib/shortcuts";
import { fromFileList } from "@/lib/utils/s3/dropEntries";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuShortcut,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { cn } from "@s3-viewer/ui/lib/utils";
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

/** Only the common half of the menu is worth a key of its own. */
const MODE_KEYS: Partial<Record<UploadMode, string>> = { files: "u" };

const FOLDER_INPUT_ATTRS = { webkitdirectory: "" } as const;

type UploadMenuProps = {
   className?: string;
   disabled?: boolean;
};

const UploadMenu = ({ className, disabled = false }: UploadMenuProps) => {
   const { upload, isChecking } = useUploader();
   const inputs = useRef<Partial<Record<UploadMode, HTMLInputElement | null>>>(
      {}
   );

   useShortcut({
      keys: "u",
      label: "Upload files",
      group: "Objects",
      when: () => !disabled && !isChecking,
      // A keypress is a user gesture, so the picker is allowed to open.
      handler: () => inputs.current.files?.click(),
   });

   return (
      <>
         <DropdownMenu>
            <SimpleTooltip label="Upload" shortcut="u">
               <DropdownMenuTrigger asChild>
                  <Button
                     variant="outline"
                     loading={isChecking}
                     disabled={disabled}
                     className={cn("[&_svg]:size-4", className)}
                  >
                     <Upload aria-hidden="true" />
                     Upload
                     <ChevronDown aria-hidden="true" />
                  </Button>
               </DropdownMenuTrigger>
            </SimpleTooltip>
            <DropdownMenuContent align="end" className="w-48">
               {MODES.map((mode) => {
                  const Icon = MODE_ICON[mode];
                  const keys = MODE_KEYS[mode];
                  return (
                     <DropdownMenuItem
                        key={mode}
                        onSelect={() => inputs.current[mode]?.click()}
                     >
                        <Icon aria-hidden="true" />
                        {MODE_LABEL[mode]}
                        {keys && <DropdownMenuShortcut keys={keys} />}
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
