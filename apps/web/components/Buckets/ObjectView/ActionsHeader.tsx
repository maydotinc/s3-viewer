import { useState, useCallback, useRef } from "react";
import { Button } from "@s3-viewer/ui/components/button";
import { ChevronLeft, Copy, Check, Download, Trash2 } from "lucide-react";

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
   const [copied, setCopied] = useState(false);
   const timeoutRef = useRef<NodeJS.Timeout | null>(null);

   const handleCopy = useCallback(() => {
      navigator.clipboard.writeText(objectName);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1500);
   }, [objectName]);

   return (
      <div className="flex pb-6 gap-4 w-full justify-between max-w-full max-lg:flex-col max-lg:justify-start">
         <div className="flex items-center gap-2 min-w-0">
            <span
               onClick={onBack}
               className="flex items-center cursor-pointer text-sm text-gray-600 hover:underline select-none"
               role="button"
               tabIndex={0}
            >
               <ChevronLeft className="size-5" />
            </span>
            <h1 className="truncate text-lg max-w-[400px]">{objectName}</h1>
            <Button
               variant="outline"
               className="aspect-square size-6 flex items-center justify-center p-2"
               onClick={handleCopy}
               disabled={isLoading}
            >
               <span className="size-3 flex items-center justify-center">
                  {!copied ? (
                     <Copy className="size-3 transition-all duration-200" />
                  ) : (
                     <Check className="size-3 transition-all duration-200 text-viewerblue" />
                  )}
               </span>
            </Button>
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
