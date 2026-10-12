const createWebLocks = (): LockManager => {
   const held = new Set<string>();
   const queued = new Map<string, Array<() => void>>();
   const request = <T>(
      name: string,
      optionsOrCallback:
         | LockOptions
         | ((lock: Lock | null) => T | PromiseLike<T>),
      callback?: (lock: Lock | null) => T | PromiseLike<T>
   ): Promise<T> => {
      const options =
         typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
      const run =
         typeof optionsOrCallback === "function"
            ? optionsOrCallback
            : callback!;
      if (held.has(name) && options.ifAvailable)
         return Promise.resolve(run(null));
      return new Promise<T>((resolve, reject) => {
         const start = () => {
            held.add(name);
            const release = () => {
               held.delete(name);
               const next = queued.get(name)?.shift();
               if (next) next();
               else queued.delete(name);
            };
            Promise.resolve()
               .then(() => run({ name, mode: "exclusive" }))
               .then(
                  (value) => {
                     release();
                     resolve(value);
                  },
                  (error: unknown) => {
                     release();
                     reject(error);
                  }
               );
         };
         if (held.has(name)) {
            const waiting = queued.get(name) ?? [];
            waiting.push(start);
            queued.set(name, waiting);
         } else start();
      });
   };
   return { request } as LockManager;
};

export { createWebLocks };
