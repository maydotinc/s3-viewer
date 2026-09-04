import { twMerge } from "tailwind-merge";

type ClassValue =
   | string
   | number
   | boolean
   | null
   | undefined
   | ClassValue[]
   | Record<string, unknown>;

const toClassName = (value: ClassValue): string => {
   if (!value || value === true) return "";
   if (typeof value !== "object") return String(value);
   if (Array.isArray(value))
      return value.map(toClassName).filter(Boolean).join(" ");
   return Object.keys(value)
      .filter((key) => value[key])
      .join(" ");
};

export function cn(...inputs: ClassValue[]) {
   return twMerge(toClassName(inputs));
}

export function stringToColor(string: string): string {
   let hash = 0;
   for (let i = 0; i < string.length; i++) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
   }
   const hue = ((hash % 360) + 360) % 360;
   return `hsl(${hue}, 42%, 32%)`;
}

export type { ClassValue };
