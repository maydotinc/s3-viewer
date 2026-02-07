import { Button } from "@s3-viewer/ui/components/button";
import { ArrowLeft, Download, Trash2 } from "lucide-react";

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
         <div className="flex items-center gap-4 min-w-0">
            <Button
               variant="ghost"
               size="icon"
               onClick={onBack}
               className="flex items-center"
            >
               <ArrowLeft className="size-5" />
            </Button>
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
