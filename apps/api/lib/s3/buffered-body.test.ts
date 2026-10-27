import { afterEach, describe, expect, it, vi } from "vitest";
import { BUFFERED_BODY_SLAB_BYTES, createBufferedBody } from "./buffered-body";
import { createReadBudget } from "./read-budget";

afterEach(() => vi.restoreAllMocks());

const budgetFor = (maxBytes: number) =>
   createReadBudget({
      maxBytes,
      maxUserBytes: maxBytes,
      maxServerBytes: maxBytes,
      maxReads: 1,
      maxUserReads: 1,
      maxServerReads: 1,
   });

describe("owned buffered body", () => {
   it("copies views into owned slabs across slab boundaries and finalizes once", () => {
      const reservation = budgetFor(100 * BUFFERED_BODY_SLAB_BYTES).acquire({
         serverId: "boundaries",
      });
      const input = Buffer.alloc(BUFFERED_BODY_SLAB_BYTES * 2 + 17, 123);
      const collected = createBufferedBody(reservation);
      collected.append(input.subarray(0, 11));
      collected.append(input.subarray(11, BUFFERED_BODY_SLAB_BYTES + 3));
      collected.append(input.subarray(BUFFERED_BODY_SLAB_BYTES + 3));
      // the source may reuse its buffer once a chunk has been handed over.
      input.fill(0);
      const result = collected.toBuffer();
      expect(result).toEqual(
         Buffer.alloc(BUFFERED_BODY_SLAB_BYTES * 2 + 17, 123)
      );
      expect(result.buffer.byteLength).toBe(result.length);
      expect(collected.toBuffer()).toBe(result);
      expect(() => collected.append(new Uint8Array([1]))).toThrow(/finalized/);
      reservation.release();
   });

   it("refuses a slab the budget cannot hold before allocating it", () => {
      const reservation = budgetFor(1024).acquire({ serverId: "admission" });
      const allocate = vi.spyOn(Buffer, "allocUnsafeSlow");
      const collected = createBufferedBody(reservation);
      expect(() => collected.append(new Uint8Array([1]))).toThrow(/capacity/);
      expect(allocate).not.toHaveBeenCalled();
      reservation.release();
   });
});
