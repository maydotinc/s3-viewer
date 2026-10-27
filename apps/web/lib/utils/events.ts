import type { MouseEvent } from "react";

const isModifiedClick = (event: MouseEvent): boolean =>
   event.metaKey ||
   event.ctrlKey ||
   event.shiftKey ||
   event.altKey ||
   event.button !== 0;

export { isModifiedClick };
