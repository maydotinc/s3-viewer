import { PointerEvent, useState } from "react";

export const useHoverPause = () => {
   const [hovered, setHovered] = useState(false);
   const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") setHovered(true);
   };
   const onPointerLeave = () => setHovered(false);
   return { hovered, hoverProps: { onPointerEnter, onPointerLeave } };
};
