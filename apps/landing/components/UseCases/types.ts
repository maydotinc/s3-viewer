import type { ComponentType } from "react";

export type UseCaseStep = {
   title: string;
   body: string;
};

export type UseCaseFeature = {
   icon: ComponentType<{ className?: string; strokeWidth?: number }>;
   title: string;
   body: string;
};
