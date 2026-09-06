import { PointerEvent, useState } from "react";

// mouse-only hover tracking: touch never sticks a figure in its paused state
export const useHoverPause = () => {
   const [hovered, setHovered] = useState(false);
   const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") setHovered(true);
   };
   const onPointerLeave = () => setHovered(false);
   return { hovered, hoverProps: { onPointerEnter, onPointerLeave } };
};
