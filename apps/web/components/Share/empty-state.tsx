import { Button } from "@s3-viewer/ui/components/button";
import { LucideIcon } from "lucide-react";

type EmptyStateProps = {
   icon: LucideIcon;
   message: string;
   actionLabel: string;
   onAction: () => void;
};

const EmptyState = ({
   icon: Icon,
   message,
   actionLabel,
   onAction,
}: EmptyStateProps) => (
   <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-viewergray">
         <Icon aria-hidden="true" className="size-5 text-viewerlighttext" />
      </span>
      <p className="text-sm text-viewertext">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onAction}>
         {actionLabel}
      </Button>
   </div>
);

export default EmptyState;
