import { useClientValue } from "./use-client-value";

const pad = (n: number) => String(n).padStart(2, "0");

const todayIso = () => {
   const d = new Date();
   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// an empty server value keeps static pages from showing their build date.
export const useToday = () => useClientValue(todayIso, "");
