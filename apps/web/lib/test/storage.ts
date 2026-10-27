const createMemoryStorage = (): Storage & { memory: Map<string, string> } => {
   const memory = new Map<string, string>();
   return {
      memory,
      get length() {
         return memory.size;
      },
      key: (index) => [...memory.keys()][index] ?? null,
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, String(value)),
      removeItem: (key) => void memory.delete(key),
      clear: () => memory.clear(),
   };
};

export { createMemoryStorage };
