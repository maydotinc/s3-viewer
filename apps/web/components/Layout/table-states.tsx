import QueryStatus from "@/components/query-status";
import StatusMessage from "@/components/status-message";
import { TableCell, TableRow } from "@s3-viewer/ui/components/table";
import type { LucideIcon } from "lucide-react";

const TABLE_PANEL =
   "@container min-h-64 min-w-0 flex-1 overflow-auto rounded-xl border border-viewerborder bg-viewerwhite [scrollbar-gutter:stable]";

// below md each row becomes a card so the row actions stay on screen instead of past a horizontal scroll
const STACKED_TABLE =
   "md:min-w-[640px] md:table-fixed max-md:block max-md:[&_thead]:hidden max-md:[&_tbody]:block max-md:[&_tbody_tr]:flex max-md:[&_tbody_tr]:h-auto max-md:[&_tbody_tr]:flex-col max-md:[&_tbody_tr]:gap-1 max-md:[&_tbody_tr]:px-4 max-md:[&_tbody_tr]:py-3 max-md:[&_td]:block max-md:[&_td]:h-auto max-md:[&_td]:p-0 max-md:[&_td]:text-left";

const STACKED_LABEL =
   "max-md:before:mr-2 max-md:before:text-viewerlighttext max-md:before:content-[attr(data-label)]";

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
