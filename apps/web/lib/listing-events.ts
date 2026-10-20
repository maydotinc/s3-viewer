type ListingChange = {
   serverId: string;
   bucketName: string;
   keys: readonly string[];
};
type ListingScope = { serverId: string; bucketName: string; prefix: string };
type Listener = (change?: ListingChange) => void;

const listeners = new Set<Listener>();

const onListingChanged = (listener: Listener): (() => void) => {
   listeners.add(listener);
   return () => {
      listeners.delete(listener);
   };
};

const notifyListingChanged = (change?: ListingChange): void => {
   for (const listener of [...listeners]) listener(change);
};

// an unscoped change could touch any listing, so every open grid reloads
const changeReaches = (
   change: ListingChange | undefined,
   scope: ListingScope
): boolean =>
   !change ||
   (change.serverId === scope.serverId &&
      change.bucketName === scope.bucketName &&
      change.keys.some((key) => key.startsWith(scope.prefix)));

export { changeReaches, notifyListingChanged, onListingChanged };
