import { useCallback, useState, type CSSProperties } from "react";

// a multi-step screen keeps the height of its first (tallest) step so the
// footer under it never moves when a shorter step takes over. A callback ref
// measures on mount, which is what the step's own render triggers
const useStepHeight = (measure: boolean) => {
   const [height, setHeight] = useState<number>();
   const ref = useCallback(
      (element: HTMLDivElement | null) => {
         if (measure && element) setHeight(element.offsetHeight);
      },
      [measure]
   );
   const style: CSSProperties | undefined = height
      ? { minHeight: height }
      : undefined;
   return { ref, style };
};

export { useStepHeight };
