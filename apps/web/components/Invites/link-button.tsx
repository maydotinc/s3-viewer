import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

type LinkButtonProps = {
   // keeps the row's height while the action is not applicable
   hidden?: boolean;
   disabled?: boolean;
   "aria-label"?: string;
   onClick: () => void;
   children: ReactNode;
};

const LinkButton = ({
   hidden = false,
   disabled,
   onClick,
   children,
   ...aria
}: LinkButtonProps) => (
   <Button
      type="button"
      variant="link"
      size="sm"
      className={cn("h-auto shrink-0 px-0", hidden && "invisible")}
      onClick={onClick}
      disabled={disabled || hidden}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      {...aria}
   >
      {children}
   </Button>
);

export default LinkButton;
