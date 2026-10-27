import { HOUR_MS, SESSION_FRESH_HOURS } from "./constants";

const isSessionFresh = (
   createdAt: Date | string | number,
   now = Date.now()
): boolean => {
   const age = now - new Date(createdAt).getTime();
   return Number.isFinite(age) && age < SESSION_FRESH_HOURS * HOUR_MS;
};

export { isSessionFresh };
