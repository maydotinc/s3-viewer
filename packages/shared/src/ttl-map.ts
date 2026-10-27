type TtlMap<K, V> = {
   get: (key: K, now?: number) => V | undefined;
   set: (key: K, value: V, expiresAt: number, now?: number) => void;
   delete: (key: K) => void;
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
      delete: (key) => {
         entries.delete(key);
      },
   };
};

type WindowHit = { hits: number; resetAt: number };

// one fixed-window counter behind every rate limit, kept in memory per process or in the rate_limit table.
type WindowCounter = {
   hit: (key: string, windowMs: number, now?: number) => Promise<WindowHit>;
   undo: (key: string) => Promise<void>;
   reset: (key: string) => Promise<void>;
};

type MemoryWindows = {
   hit: (key: string, windowMs: number, now?: number) => WindowHit;
   undo: (key: string) => void;
   reset: (key: string) => void;
};

// the same fixed window as the rate_limit table: it starts at the first hit, counts refused hits
// too and resets on the first hit after it ends, so RATE_LIMIT_STORE=memory behaves the same.
const memoryWindows = (maxKeys: number): MemoryWindows => {
   const windows = ttlMap<string, WindowHit>(maxKeys);
   return {
      hit: (key, windowMs, now = Date.now()) => {
         const live = windows.get(key, now);
         const window = live
            ? { hits: live.hits + 1, resetAt: live.resetAt }
            : { hits: 1, resetAt: now + windowMs };
         windows.set(key, window, window.resetAt, now);
         return { ...window };
      },
      // like the table's undo it ignores resetAt; an expired window restarts on its next hit anyway.
      undo: (key) => {
         const window = windows.get(key, -Infinity);
         if (window) window.hits = Math.max(window.hits - 1, 0);
      },
      reset: windows.delete,
   };
};

const memoryWindowCounter = (maxKeys: number): WindowCounter => {
   const windows = memoryWindows(maxKeys);
   return {
      hit: async (key, windowMs, now) => windows.hit(key, windowMs, now),
      undo: async (key) => windows.undo(key),
      reset: async (key) => windows.reset(key),
   };
};

export { memoryWindowCounter, memoryWindows, ttlMap };
export type { WindowCounter };
