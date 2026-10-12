import { formatCount } from "@/lib/utils/format";

type Failure = { key: string; message: string };

const MAX_ROWS = 100;

const FailureList = ({ failures }: { failures: Failure[] }) => {
   if (failures.length === 0) return null;
   const shown = failures.slice(0, MAX_ROWS);
   const hidden = failures.length - shown.length;
   return (
      <ul className="max-h-40 overflow-y-auto rounded-md border border-viewerborder bg-viewergray p-2 text-xs text-viewertext [overflow-wrap:anywhere]">
         {shown.map((failure) => (
            <li key={failure.key}>
               <span className="font-medium text-viewerblack">
                  {failure.key}
               </span>{" "}
               — {failure.message}
            </li>
         ))}
         {hidden > 0 && <li>and {formatCount(hidden)} more</li>}
      </ul>
   );
};

export default FailureList;
