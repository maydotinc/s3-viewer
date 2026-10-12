import { AwsArtwork, CloudflarePaths } from "@/components/provider-art";
import type { ProviderId } from "@/lib/provider-paths";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ReactNode } from "react";

type MarkProps = { className?: string };

export const CloudflareMark = ({ className }: MarkProps) => (
   <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-4 shrink-0", className)}
   >
      <CloudflarePaths />
   </svg>
);

const AwsMark = ({ className }: MarkProps) => (
   <svg
      viewBox="0 0 40 24"
      aria-hidden
      className={cn("h-3 w-auto shrink-0", className)}
   >
      <g transform="translate(4 0)">
         <AwsArtwork />
      </g>
   </svg>
);

export const ProviderMark = ({
   provider,
   className,
}: MarkProps & { provider: ProviderId }) =>
   provider === "aws" ? (
      <AwsMark className={className} />
   ) : (
      <CloudflareMark className={className} />
   );

export const ProviderChip = ({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) => (
   <span
      className={cn(
         "grid size-6 shrink-0 place-items-center rounded-md border border-viewerborder bg-viewerwhite",
         className
      )}
   >
      {children}
   </span>
);
