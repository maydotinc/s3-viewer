import { GITHUB_URL, APP_PATH } from "@/lib/site-config";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import { SiteLink } from "@/components/external-link";
import { GitHubMark } from "@/components/social-marks";
import { ReactNode } from "react";

type Cta = { href: string; label: string };

export type CtaButtonsProps = {
   primary?: Cta;
   secondary?: Cta;
   secondaryIcon?: ReactNode;
   chevron?: boolean;
   className?: string;
};

const BUTTON = "h-11 w-full px-6 text-[15px] sm:w-auto";

const CtaButtons = ({
   primary = { href: APP_PATH, label: "Open app" },
   secondary = { href: GITHUB_URL, label: "Star on GitHub" },
   secondaryIcon = <GitHubMark />,
   chevron = false,
   className,
}: CtaButtonsProps) => (
   <div
      className={cn(
         "flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row",
         className
      )}
   >
      <Button asChild size="lg" className={BUTTON}>
         <SiteLink href={primary.href}>
            {primary.label}
            {chevron ? <ChevronRight /> : null}
         </SiteLink>
      </Button>
      <Button asChild variant="outline" size="lg" className={BUTTON}>
         <SiteLink href={secondary.href}>
            {secondaryIcon}
            {secondary.label}
         </SiteLink>
      </Button>
   </div>
);

export default CtaButtons;
