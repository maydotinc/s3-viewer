import QueryStatus from "@/components/query-status";
import StatusMessage from "@/components/status-message";
import { TableCell, TableRow } from "@s3-viewer/ui/components/table";
import type { LucideIcon } from "lucide-react";

const TABLE_PANEL =
   "@container min-h-64 min-w-0 flex-1 overflow-auto rounded-xl border border-viewerborder bg-viewerwhite [scrollbar-gutter:stable]";

// in a narrow panel each row becomes a card so the row actions stay on screen instead of past a horizontal scroll
const STACKED_TABLE =
   "@min-[40rem]:min-w-[640px] @min-[40rem]:table-fixed @max-[40rem]:block @max-[40rem]:[&_thead]:hidden @max-[40rem]:[&_tbody]:block @max-[40rem]:[&_tbody_tr]:flex @max-[40rem]:[&_tbody_tr]:h-auto @max-[40rem]:[&_tbody_tr]:flex-col @max-[40rem]:[&_tbody_tr]:gap-1 @max-[40rem]:[&_tbody_tr]:px-4 @max-[40rem]:[&_tbody_tr]:py-3 @max-[40rem]:[&_td]:block @max-[40rem]:[&_td]:h-auto @max-[40rem]:[&_td]:p-0 @max-[40rem]:[&_td]:text-left";

const STACKED_LABEL =
   "@max-[40rem]:before:mr-2 @max-[40rem]:before:text-viewerlighttext @max-[40rem]:before:content-[attr(data-label)]";

const EMPTY_NOTICE = "py-12";

type EmptyRowProps = {
   colSpan: number;
   icon: LucideIcon;
   children: string;
};

const EmptyRow = ({ colSpan, icon, children }: EmptyRowProps) => (
   <TableRow className="h-auto hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-auto p-0 whitespace-normal">
         <div className="sticky left-0 flex w-[min(100%,100cqw)]">
            <StatusMessage icon={icon} className={EMPTY_NOTICE}>
               {children}
            </StatusMessage>
         </div>
      </TableCell>
   </TableRow>
);

type TableErrorProps = {
   title: string;
   children: string;
   onRetry?: () => void;
   retrying?: boolean;
};

const TableError = ({
   title,
   children,
   onRetry,
   retrying,
}: TableErrorProps) => (
   <QueryStatus
      error={children}
      title={title}
      className="min-h-64"
      onRetry={onRetry}
      retrying={retrying}
   />
);

export {
   EMPTY_NOTICE,
   EmptyRow,
   STACKED_LABEL,
   STACKED_TABLE,
   TABLE_PANEL,
   TableError,
};
