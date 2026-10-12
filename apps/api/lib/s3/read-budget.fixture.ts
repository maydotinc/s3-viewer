import { vi } from "vitest";
import { createReadBudget, readBudget } from "./read-budget";

type ReadCounts = { total: number; user: number; server: number };

// swaps the process-wide budget for one sized to the test, restored by vi.restoreAllMocks().
const installReadBudget = (
   maxBytes: number,
   reads: ReadCounts = { total: 64, user: 64, server: 64 }
) => {
   const budget = createReadBudget({
      maxBytes,
      maxUserBytes: maxBytes,
      maxServerBytes: maxBytes,
      maxReads: reads.total,
      maxUserReads: reads.user,
      maxServerReads: reads.server,
   });
   vi.spyOn(readBudget, "acquire").mockImplementation(budget.acquire);
   return budget;
};

export { installReadBudget };
