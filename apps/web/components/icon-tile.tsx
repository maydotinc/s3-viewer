import { cn } from "@s3-viewer/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "error";

const TONES: Record<Tone, { tile: string; icon: string }> = {
   neutral: { tile: "bg-viewergray", icon: "text-viewerlighttext" },
   error: { tile: "bg-viewerbgred", icon: "text-viewertextred" },
};

const IconTile = ({
   icon: Icon,
   tone = "neutral",
}: {
   icon: LucideIcon;
   tone?: Tone;
}) => (
   <span
      className={cn(
         "flex size-10 shrink-0 items-center justify-center rounded-lg",
         TONES[tone].tile
      )}
   >
      <Icon className={cn("size-5", TONES[tone].icon)} aria-hidden="true" />
   </span>
);

export default IconTile;
export type { Tone };
