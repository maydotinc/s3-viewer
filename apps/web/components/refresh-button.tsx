import RefreshIcon from "@/components/refresh-icon";
import { Button } from "@s3-viewer/ui/components/button";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";

type RefreshButtonProps = {
   spinning: boolean;
   disabled?: boolean;
   onClick: () => void;
   shortcut?: string;
   size?: "icon" | "icon-sm";
};

const LABEL = "Refresh";

const RefreshButton = ({
   spinning,
   disabled,
   onClick,
   shortcut,
   size = "icon",
}: RefreshButtonProps) => (
   <SimpleTooltip label={LABEL} shortcut={shortcut}>
      <Button
         type="button"
         variant="outline"
         size={size}
         aria-label={LABEL}
         disabled={disabled}
         onClick={onClick}
      >
         <RefreshIcon spinning={spinning} />
      </Button>
   </SimpleTooltip>
);

export default RefreshButton;
