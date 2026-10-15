import {
   grantLabel,
   limitedGrants,
   limitedGrantsNote,
} from "@/lib/utils/folder-access";
import { formatCount } from "@/lib/utils/format";
import type { BucketAccessEntry } from "@s3-viewer/types";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";

const MAX_LISTED = 8;

const FolderLimitNote = ({
   entries,
}: {
   entries: readonly BucketAccessEntry[];
}) => {
   const note = limitedGrantsNote(entries);
   if (!note) return null;
   const limited = limitedGrants(entries);
   const shown = limited.slice(0, MAX_LISTED);
   return (
      <SimpleTooltip
         label={
            <ul className="flex max-w-72 flex-col gap-1">
               {shown.map((entry) => (
                  <li key={entry.bucketName}>
                     <span className="font-semibold">{entry.bucketName}</span> ·{" "}
                     {grantLabel(entry)}
                     {entry.folders.length > 1 && (
                        <span className="block font-normal opacity-80">
                           {entry.folders.join(", ")}
                        </span>
                     )}
                  </li>
               ))}
               {limited.length > shown.length && (
                  <li>and {formatCount(limited.length - shown.length)} more</li>
               )}
            </ul>
         }
      >
         <span
            tabIndex={0}
            className={`line-clamp-2 min-w-0 rounded-sm text-xs break-words whitespace-normal text-viewerlighttext outline-none ${FOCUS_RING}`}
         >
            {note}
         </span>
      </SimpleTooltip>
   );
};

export default FolderLimitNote;
