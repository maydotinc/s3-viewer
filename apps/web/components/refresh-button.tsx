import RefreshIcon from "@/components/refresh-icon";
import { Button } from "@s3-viewer/ui/components/button";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";

type RefreshButtonProps = {
   spinning: boolean;
   disabled?: boolean;
   onClick: () => void;
   label?: string;
   shortcut?: string;
   size?: "icon" | "icon-sm";
};

const RefreshButton = ({
   spinning,
   disabled,
   onClick,
   label = "Refresh",
   shortcut,
   size = "icon",
}: RefreshButtonProps) => (
   <SimpleTooltip label={label} shortcut={shortcut}>
      <Button
         type="button"
         variant="outline"
         size={size}
         aria-label={label}
         disabled={disabled}
         onClick={onClick}
      >
         <RefreshIcon spinning={spinning} />
      </Button>
   </SimpleTooltip>
);

export default RefreshButton;
