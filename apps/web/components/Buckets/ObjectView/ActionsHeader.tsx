import { Button } from "@s3-viewer/ui/components/button";
import { ArrowLeft, ChevronLeft, Download, Trash2 } from "lucide-react";

interface ObjectActionsHeaderProps {
   objectName: string;
   isLoading: boolean;
   onBack: () => void;
   onDownload: () => void;
   onDelete: () => void;
}

const ObjectActionsHeader = ({
   objectName,
   isLoading,
   onBack,
   onDownload,
   onDelete,
}: ObjectActionsHeaderProps) => {
   return (
      <div className="flex pb-6 gap-4 w-full justify-between max-w-full max-lg:flex-col max-lg:justify-start">
         <div className="flex items-center gap-2 min-w-0">
            <span
               onClick={onBack}
               className="flex items-center cursor-pointer text-sm text-gray-600 hover:underline select-none"
               role="button"
               tabIndex={0}
            >
               <ChevronLeft className="size-5 mr-1" />
            </span>
            <h1 className="truncate text-lg max-w-[400px]">{objectName}</h1>
         </div>
         <div className="flex gap-2">
            <Button variant="outline" onClick={onDownload} disabled={isLoading}>
               <Download className="size-4" />
               Download
            </Button>
            <Button
               variant="destructive"
               onClick={onDelete}
               disabled={isLoading}
            >
               <Trash2 className="size-4" />
               Delete
            </Button>
         </div>
      </div>
   );
};

export default ObjectActionsHeader;
