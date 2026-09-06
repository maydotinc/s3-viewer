import { useSyncExternalStore } from "react";

const noop = () => () => {};

const pad = (n: number) => String(n).padStart(2, "0");

const todayIso = () => {
   const d = new Date();
   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "" during ssr and hydration, the viewer's local date right after, so the
// static page never bakes in its build date and the markup still matches.
export const useToday = () => useSyncExternalStore(noop, todayIso, () => "");
