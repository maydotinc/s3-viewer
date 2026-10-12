type Listener = () => void;

const listeners = new Set<Listener>();

const onListingChanged = (listener: Listener): (() => void) => {
   listeners.add(listener);
   return () => {
      listeners.delete(listener);
   };
};

const notifyListingChanged = (): void => {
   for (const listener of [...listeners]) listener();
};

export { notifyListingChanged, onListingChanged };
