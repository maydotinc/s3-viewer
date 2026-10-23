type TtlMap<K, V> = {
   get: (key: K, now?: number) => V | undefined;
   set: (key: K, value: V, expiresAt: number, now?: number) => void;
};

const SWEEP_EVERY = 1000;

// keys a client can mint must not grow the map without bound: expired entries go every SWEEP_EVERY writes, and past
// maxKeys the least recently written live ones go too.
const ttlMap = <K, V>(maxKeys: number): TtlMap<K, V> => {
   const entries = new Map<K, { value: V; expiresAt: number }>();
   let writes = 0;

   const sweep = (now: number): void => {
      for (const [key, { expiresAt }] of entries)
         if (expiresAt <= now) entries.delete(key);
   };

   return {
      get: (key, now = Date.now()) => {
         const entry = entries.get(key);
         if (!entry) return undefined;
         if (entry.expiresAt > now) return entry.value;
         entries.delete(key);
         return undefined;
      },
      set: (key, value, expiresAt, now = Date.now()) => {
         if (++writes % SWEEP_EVERY === 0) sweep(now);
         // delete-then-set moves the key to the end, so the first key is always the oldest write.
         entries.delete(key);
         entries.set(key, { value, expiresAt });
         for (const oldest of entries.keys()) {
            if (entries.size <= maxKeys) break;
            entries.delete(oldest);
         }
      },
   };
};

export { ttlMap };
