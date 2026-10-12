// runs each transaction after the previous one settles, like a single database connection.
const serialTransactions = <Tx>(
   tx: Tx,
   { checkpoint }: { checkpoint?: () => () => void } = {}
) => {
   let tail = Promise.resolve();
   return async <T>(work: (client: Tx) => Promise<T>): Promise<T> => {
      const previous = tail;
      const { promise, resolve: release } = Promise.withResolvers<void>();
      tail = promise;
      await previous;
      const rollback = checkpoint?.();
      try {
         return await work(tx);
      } catch (error) {
         rollback?.();
         throw error;
      } finally {
         release();
      }
   };
};

export { serialTransactions };
