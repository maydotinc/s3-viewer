import { MULTIPART_CONCURRENCY } from "@s3-viewer/types";

type Waiter = () => void;

const createSlotPool = (limit: number) => {
   let held = 0;
   const heldBy = new Map<string, number>();
   const queues = new Map<string, Waiter[]>();
   const order: string[] = [];

   const claim = (job: string) => heldBy.set(job, (heldBy.get(job) ?? 0) + 1);

   const release = (job: string) => {
      const count = (heldBy.get(job) ?? 1) - 1;
      if (count > 0) heldBy.set(job, count);
      else heldBy.delete(job);
   };

   const enqueue = (job: string) =>
      new Promise<void>((resolve) => {
         const waiting = queues.get(job);
         if (waiting) waiting.push(resolve);
         else {
            queues.set(job, [resolve]);
            order.push(job);
         }
      });

   const nextJob = (): string | undefined => {
      let chosen: string | undefined;
      let fewest = Number.POSITIVE_INFINITY;
      for (const job of order) {
         const count = heldBy.get(job) ?? 0;
         if (count < fewest) {
            fewest = count;
            chosen = job;
         }
      }
      return chosen;
   };

   const handOff = (): boolean => {
      const job = nextJob();
      if (job === undefined) return false;
      const waiting = queues.get(job)!;
      const next = waiting.shift()!;
      order.splice(order.indexOf(job), 1);
      if (waiting.length > 0) order.push(job);
      else queues.delete(job);
      claim(job);
      next();
      return true;
   };

   return async <T>(job: string, task: () => Promise<T>): Promise<T> => {
      if (held < limit) {
         held++;
         claim(job);
      } else await enqueue(job);
      try {
         return await task();
      } finally {
         release(job);
         if (!handOff()) held--;
      }
   };
};

const uploadSlot = createSlotPool(MULTIPART_CONCURRENCY);

let uploadJobs = 0;

const nextUploadJob = (): string => `job-${++uploadJobs}`;

export { createSlotPool, nextUploadJob, uploadSlot };
