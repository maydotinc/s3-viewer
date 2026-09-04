import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
   icon: LucideIcon;
   action?: ReactNode;
   children: ReactNode;
};

const EmptyState = ({ icon: Icon, action, children }: EmptyStateProps) => (
   <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-viewergray">
         <Icon className="size-5 text-viewerlighttext" aria-hidden="true" />
      </span>
      <p className="text-sm text-viewertext">{children}</p>
      {action}
   </div>
);

export default EmptyState;
