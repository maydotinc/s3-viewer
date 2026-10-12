import { useClientValue } from "./use-client-value";

const currentYear = () => String(new Date().getFullYear());

const buildYear = currentYear();

export const useCurrentYear = () => useClientValue(currentYear, buildYear);
