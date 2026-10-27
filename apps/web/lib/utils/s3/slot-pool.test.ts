import { describe, expect, it } from "vitest";
import { createSlotPool } from "./slot-pool";

type Task = { finish: () => void; done: Promise<string> };

const controllable = (
   withSlot: ReturnType<typeof createSlotPool>,
   job: string,
   label: string,
   log: string[]
): Task => {
   let release: (() => void) | null = null;
   let asked = false;
   const done = withSlot(job, () => {
      log.push(label);
      return new Promise<string>((resolve) => {
         release = () => resolve(label);
         if (asked) release();
      });
   });
   return {
      finish: () => {
         asked = true;
         release?.();
      },
      done,
   };
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("sharing a bounded pool between jobs", () => {
   it("never runs more tasks at once than the limit", async () => {
      const withSlot = createSlotPool(2);
      const log: string[] = [];
      const tasks = ["a", "b", "c", "d"].map((label) =>
         controllable(withSlot, "one", label, log)
      );

      await flush();
      expect(log).toEqual(["a", "b"]);

      tasks[0]!.finish();
      await flush();
      expect(log).toEqual(["a", "b", "c"]);

      for (const task of tasks) task.finish();
      await expect(
         Promise.all(tasks.map((task) => task.done))
      ).resolves.toEqual(["a", "b", "c", "d"]);
   });

   it("gives every waiting job a slot instead of draining the first one", async () => {
      const withSlot = createSlotPool(3);
      const log: string[] = [];
      const first = Array.from({ length: 6 }, (_unused, index) =>
         controllable(withSlot, "file-1", `1.${index}`, log)
      );
      const second = controllable(withSlot, "file-2", "2.0", log);
      const third = controllable(withSlot, "file-3", "3.0", log);

      await flush();
      expect(log).toEqual(["1.0", "1.1", "1.2"]);

      first[0]!.finish();
      await flush();
      first[1]!.finish();
      await flush();
      first[2]!.finish();
      await flush();

      expect(log.slice(3)).toEqual(["2.0", "3.0", "1.3"]);

      second.finish();
      third.finish();
      for (const task of first) task.finish();
      await Promise.all([
         second.done,
         third.done,
         ...first.map((task) => task.done),
      ]);
   });

   it("hands a freed slot to one waiter only, even when a task throws", async () => {
      const withSlot = createSlotPool(1);
      const log: string[] = [];
      const failing = withSlot("file-1", () => {
         log.push("boom");
         return Promise.reject(new Error("boom"));
      });
      const queued = ["a", "b"].map((label) =>
         controllable(withSlot, "file-2", label, log)
      );

      await expect(failing).rejects.toThrow("boom");
      await flush();
      expect(log).toEqual(["boom", "a"]);

      queued[0]!.finish();
      await flush();
      expect(log).toEqual(["boom", "a", "b"]);
      queued[1]!.finish();
      await Promise.all(queued.map((task) => task.done));
   });
});
