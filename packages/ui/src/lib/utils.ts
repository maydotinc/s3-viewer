import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
}

export function stringToColor(string: string): string {
   let hash = 0;
   for (let i = 0; i < string.length; i++) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
   }
   const hue = ((hash % 360) + 360) % 360;
   return `hsl(${hue}, 42%, 32%)`;
}
