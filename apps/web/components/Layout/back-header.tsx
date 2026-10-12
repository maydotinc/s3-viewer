import { PageHeader, PageTitle } from "./page";
import { Button } from "@s3-viewer/ui/components/button";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

type BackHeaderProps = {
   title: string;
   description: string;
   onBack: () => void;
   actions?: ReactNode;
};

const BackHeader = ({
   title,
   description,
   onBack,
   actions,
}: BackHeaderProps) => (
   <PageHeader actions={actions}>
      <div className="flex min-w-0 items-start gap-3">
         <SimpleTooltip label="Back" shortcut="Esc">
            <Button
               type="button"
               variant="ghost"
               size="icon"
               aria-label="Back"
               className="shrink-0"
               onClick={onBack}
            >
               <ChevronLeft aria-hidden="true" />
            </Button>
         </SimpleTooltip>
         <div className="flex min-w-0 flex-col gap-1">
            <PageTitle title={title}>{title}</PageTitle>
            <p className="text-sm text-viewertext">{description}</p>
         </div>
      </div>
   </PageHeader>
);

export default BackHeader;
