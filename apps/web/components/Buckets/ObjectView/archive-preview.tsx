import { archiveLabel } from "@/lib/utils/file-utils";
import { formatBytes } from "@/lib/utils/format";
import type { S3ObjectPreview } from "@s3-viewer/types";
import { FileArchive } from "lucide-react";
import { PREVIEW_BOX } from "./preview-frame";

// archives never get a browser preview, so this states what the file is instead of what it can't do
const ArchivePreview = ({
   preview,
   fileName,
}: {
   preview: S3ObjectPreview;
   fileName: string;
}) => (
   <div className={PREVIEW_BOX}>
      <div className="flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-center">
         <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-viewergray">
            <FileArchive
               className="size-7 text-viewertext"
               aria-hidden="true"
            />
         </span>
         <div className="flex w-full min-w-0 flex-col items-center gap-2">
            <p
               className="max-w-full truncate text-base font-semibold text-viewerblack"
               title={fileName}
            >
               {fileName}
            </p>
            <p className="flex items-center gap-2 text-xs">
               <span className="rounded-md border border-viewerborder bg-viewergray px-2 py-0.5 font-medium text-viewertext">
                  {archiveLabel(preview.contentType, fileName) ??
                     "Compressed archive"}
               </span>
               <span className="text-viewerlighttext">
                  {formatBytes(preview.contentLength)}
               </span>
            </p>
         </div>
         <p className="text-sm text-viewertext">
            Archives can&apos;t be previewed in the browser. Download it to open
            it.
         </p>
      </div>
   </div>
);

export default ArchivePreview;
