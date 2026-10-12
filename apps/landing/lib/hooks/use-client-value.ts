import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// static HTML renders the server value; hydration swaps in the client one without a mismatch.
export const useClientValue = <T>(read: () => T, server: T): T =>
   useSyncExternalStore(noopSubscribe, read, () => server);
