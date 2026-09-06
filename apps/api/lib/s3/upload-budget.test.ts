import { describe, expect, it } from "vitest";
import { createUploadBudget } from "./upload-budget";

describe("upload admission", () => {
   it("caps each user's active uploads without blocking other users", () => {
      const budget = createUploadBudget({
         maxUploads: 3,
         maxPerUser: 1,
         maxBytes: 100,
      });
      const release = budget.acquire("a", 20);
      expect(() => budget.acquire("a", 20)).toThrow(/busy/);
      expect(() => budget.acquire("b", 20)).not.toThrow();
      release();
      release();
      expect(() => budget.acquire("a", 20)).not.toThrow();
      expect(() => budget.acquire("a", 20)).toThrow(/busy/);
   });
   it("caps global concurrency even across different accounts", () => {
      const budget = createUploadBudget({
         maxUploads: 1,
         maxPerUser: 3,
         maxBytes: 100,
      });
      const release = budget.acquire("a", 20);
      expect(() => budget.acquire("b", 20)).toThrow(/busy/);
      release();
      expect(() => budget.acquire("b", 20)).not.toThrow();
   });
   it("reserves shared memory, rejects impossible uploads, and reclaims it", () => {
      const budget = createUploadBudget({
         maxUploads: 10,
         maxPerUser: 3,
         maxBytes: 100,
      });
      expect(() => budget.acquire("a", 101)).toThrow(/buffer memory/);
      const release = budget.acquire("a", 80);
      expect(() => budget.acquire("b", 21)).toThrow(/busy/);
      release();
      expect(() => budget.acquire("b", 100)).not.toThrow();
   });
});
