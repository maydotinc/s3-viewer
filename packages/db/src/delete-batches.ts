import { setTimeout as sleep } from "node:timers/promises";

const DELETE_BATCH_SIZE = 5000;
const DELETE_PAUSE_MS = 50;

const deleteBatches = async (
   deleteBatch: (limit: number) => Promise<number>
): Promise<number> => {
   let total = 0;
   for (;;) {
      const count = await deleteBatch(DELETE_BATCH_SIZE);
      total += count;
      if (count < DELETE_BATCH_SIZE) return total;
      await sleep(DELETE_PAUSE_MS);
   }
};

export { deleteBatches };
