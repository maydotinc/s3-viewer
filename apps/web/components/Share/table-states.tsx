import { TableCell, TableRow } from "@s3-viewer/ui/components/table";
import { LucideIcon } from "lucide-react";

type EmptyRowProps = {
   colSpan: number;
   icon: LucideIcon;
   children: string;
};

const EmptyRow = ({ colSpan, icon: Icon, children }: EmptyRowProps) => (
   <TableRow className="h-auto hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-auto p-0 whitespace-normal">
         <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-viewergray">
               <Icon
                  aria-hidden="true"
                  className="size-5 text-viewerlighttext"
               />
            </span>
            <p className="text-sm text-viewertext">{children}</p>
         </div>
      </TableCell>
   </TableRow>
);

const TableError = ({ children }: { children: string }) => (
   <p
      role="alert"
      className="px-6 py-16 text-center text-sm text-viewertextred"
   >
      {children}
   </p>
);

export { EmptyRow, TableError };
