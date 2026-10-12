import {
   DropdownMenuItem,
   DropdownMenuSeparator,
} from "@s3-viewer/ui/components/dropdown-menu";
import type { LucideIcon } from "lucide-react";
import { Fragment } from "react";

type SecondaryAction = {
   label: string;
   icon: LucideIcon;
   destructive?: boolean;
   disabled?: boolean;
   description?: string | null;
   onSelect: () => void;
};

const ActionMenuItems = ({ actions }: { actions: SecondaryAction[] }) =>
   actions.map(
      (
         { label, icon: Icon, destructive, disabled, description, onSelect },
         index
      ) => (
         <Fragment key={label}>
            {destructive && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
               variant={destructive ? "destructive" : "default"}
               disabled={disabled}
               onSelect={onSelect}
            >
               <Icon aria-hidden="true" />
               {description ? (
                  <span className="flex min-w-0 flex-col">
                     {label}
                     <span className="text-xs text-viewerlighttext">
                        {description}
                     </span>
                  </span>
               ) : (
                  label
               )}
            </DropdownMenuItem>
         </Fragment>
      )
   );

export { ActionMenuItems };
export type { SecondaryAction };
