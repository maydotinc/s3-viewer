import { AwsArtwork, CloudflarePaths } from "@/components/provider-art";
import type { ProviderId } from "@/lib/provider-paths";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ReactNode } from "react";

export const CloudflareMark = ({ className }: { className?: string }) => (
   <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-4 shrink-0", className)}
   >
      <CloudflarePaths />
   </svg>
);

const AwsMark = () => (
   <svg viewBox="0 0 40 24" aria-hidden className="h-3 w-auto shrink-0">
      <g transform="translate(4 0)">
         <AwsArtwork />
      </g>
   </svg>
);

export const ProviderMark = ({ provider }: { provider: ProviderId }) =>
   provider === "aws" ? <AwsMark /> : <CloudflareMark />;

export const ProviderChip = ({ children }: { children: ReactNode }) => (
   <span className="grid size-6 shrink-0 place-items-center rounded-md border border-viewerborder bg-viewerwhite">
      {children}
   </span>
);
