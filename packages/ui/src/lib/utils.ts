import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
}

export function isValidEmail(email: string): boolean {
   const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
   return emailRegex.test(email);
}

export function stringToColor(string: string): string {
   let hash = 0;
   for (let i = 0; i < string.length; i++) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
   }
   return `hsl(${hash % 360}, 100%, 50%)`;
}
