import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";

type OverflowMenuProps = {
   // what the actions act on, e.g. a bucket or object name
   label: string;
   // shown in place of the menu when nothing in it can be used
   disabledReason?: string | null;
   children?: ReactNode;
};

const OverflowMenu = ({
   label,
   disabledReason,
   children,
}: OverflowMenuProps) => {
   const trigger = (
      <Button
         variant="ghost"
         size="icon-sm"
         aria-label={`Actions for ${label}`}
         disabled={Boolean(disabledReason)}
      >
         <Ellipsis aria-hidden="true" />
      </Button>
   );

   if (disabledReason)
      return <SimpleTooltip label={disabledReason}>{trigger}</SimpleTooltip>;

   return (
      <DropdownMenu modal={false}>
         <SimpleTooltip label={`Actions for ${label}`}>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
         </SimpleTooltip>
         <DropdownMenuContent align="end" className="w-56">
            {children}
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default OverflowMenu;
