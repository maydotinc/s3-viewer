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
