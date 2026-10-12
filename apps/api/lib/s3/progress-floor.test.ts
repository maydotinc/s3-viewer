import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
   STORAGE_FLOOR_BYTES_PER_SECOND,
   UPLOAD_FLOOR_BYTES_PER_SECOND,
   uploadMemoryFor,
} from "@/lib/constants";
import {
   floorBytesFor,
   progressFloor,
   SlotExpiredError,
   stallMsFor,
   StorageStalledError,
   UploadIdleError,
} from "./progress-floor";

const settle = (ms: number) =>
   new Promise((resolve) => setTimeout(resolve, ms));

describe("progressFloor", () => {
   it("times nothing until it is opened", async () => {
      const abortController = new AbortController();
      const floor = progressFloor({ abortController, windowMs: 10 });
      await settle(30);
      expect(abortController.signal.aborted).toBe(false);
      floor.open();
      await settle(30);
      expect(abortController.signal.reason).toBeInstanceOf(UploadIdleError);
      floor.stop();
   });

   it("measures a window in whatever unit the caller adds", async () => {
      const abortController = new AbortController();
      const floor = progressFloor({ abortController, windowMs: 20, floor: 5 });
      floor.open();
      floor.add(3);
      floor.add(3);
      await settle(25);
      expect(abortController.signal.aborted).toBe(false);
      floor.add(3);
      await settle(25);
      expect(abortController.signal.reason).toBeInstanceOf(UploadIdleError);
      floor.stop();
   });

   it("with no floor, any progress in a window keeps the stream alive", async () => {
      const abortController = new AbortController();
      const floor = progressFloor({ abortController, windowMs: 20 });
      floor.open();
      floor.add(1);
      await settle(25);
      expect(abortController.signal.aborted).toBe(false);
      await settle(25);
      expect(abortController.signal.reason).toBeInstanceOf(UploadIdleError);
      floor.stop();
   });

   it("parks the clock while the body is paused and drops it when the body ends", async () => {
      const abortController = new AbortController();
      const body = new PassThrough();
      const floor = progressFloor({ abortController, windowMs: 20, body });
      floor.open();
      await settle(30);
      expect(abortController.signal.aborted).toBe(false);
      body.resume();
      body.pause();
      await settle(30);
      expect(abortController.signal.aborted).toBe(false);
      body.resume();
      body.end();
      await settle(30);
      expect(abortController.signal.aborted).toBe(false);
      floor.stop();
   });
});

describe("a storage stall behind a paused or finished body", () => {
   const stalling = (pausedMs: number, endedMs = pausedMs) => {
      const abortController = new AbortController();
      const body = new PassThrough();
      const floor = progressFloor({
         abortController,
         windowMs: 1000,
         body,
         stall: { pausedMs, endedMs: () => endedMs },
      });
      floor.open();
      return { abortController, body, floor };
   };

   it("gives up on storage that leaves the body paused past the stall limit", async () => {
      const { abortController, body, floor } = stalling(60);
      body.resume();
      await settle(90);
      expect(abortController.signal.aborted).toBe(false);
      body.pause();
      await settle(10);
      expect(abortController.signal.aborted).toBe(false);
      await settle(80);
      expect(abortController.signal.reason).toBeInstanceOf(StorageStalledError);
      floor.stop();
   });

   it("gives each pause its own limit once storage reads again", async () => {
      const { abortController, body, floor } = stalling(80);
      body.resume();
      await settle(1);
      for (let pause = 0; pause < 4; pause++) {
         body.pause();
         await settle(30);
         body.resume();
         await settle(1);
      }
      expect(abortController.signal.aborted).toBe(false);
      floor.stop();
   });

   it("keeps one limit running until the body really flows again", async () => {
      const { abortController, body, floor } = stalling(40);
      body.resume();
      body.pause();
      await settle(25);
      body.emit("pause");
      body.emit("resume");
      await settle(25);
      expect(abortController.signal.reason).toBeInstanceOf(StorageStalledError);
      floor.stop();
   });

   it("bounds the commit after the body ends with its own limit", async () => {
      const { abortController, body, floor } = stalling(1000, 60);
      body.resume();
      body.end();
      await settle(10);
      expect(abortController.signal.aborted).toBe(false);
      await settle(80);
      expect(abortController.signal.reason).toBeInstanceOf(StorageStalledError);
      floor.stop();
   });

   it("drops both limits when the upload settles", async () => {
      const paused = stalling(15);
      paused.body.resume();
      paused.body.pause();
      paused.floor.stop();
      const ended = stalling(1000, 15);
      ended.body.resume();
      ended.body.end();
      await settle(5);
      ended.floor.stop();
      await settle(30);
      expect(paused.abortController.signal.aborted).toBe(false);
      expect(ended.abortController.signal.aborted).toBe(false);
   });

   it("never shortens a limit too long for a timer", async () => {
      const { abortController, body, floor } = stalling(2 ** 40);
      body.resume();
      body.pause();
      await settle(20);
      expect(abortController.signal.aborted).toBe(false);
      floor.stop();
   });

   it("allows the buffered parts to drain at the storage floor rate plus one idle window", () => {
      const partSize = 5 * 1024 * 1024;
      expect(stallMsFor(120_000, partSize)).toBe(
         120_000 +
            (uploadMemoryFor(partSize) / STORAGE_FLOOR_BYTES_PER_SECOND) * 1000
      );
      expect(stallMsFor(120_000, partSize)).toBeGreaterThan(
         120_000 + ((2 * partSize) / STORAGE_FLOOR_BYTES_PER_SECOND) * 1000
      );
   });

   it("holds clients to a tighter floor than storage backpressure", () => {
      expect(floorBytesFor(120_000)).toBe(120 * UPLOAD_FLOOR_BYTES_PER_SECOND);
      expect(UPLOAD_FLOOR_BYTES_PER_SECOND).toBe(128 * 1024);
      expect(STORAGE_FLOOR_BYTES_PER_SECOND).toBeLessThan(
         UPLOAD_FLOOR_BYTES_PER_SECOND
      );
   });

   it("reports an expired slot as an idle upload with its own message", () => {
      const error = new SlotExpiredError();
      expect(error).toBeInstanceOf(UploadIdleError);
      expect(error.message).toMatch(/took too long/);
      expect(new UploadIdleError().message).toMatch(/stopped receiving/);
   });
});

describe("storage byte rate behind a body that keeps pausing", () => {
   const WINDOW_MS = 100;
   const SPAN_MS = 400;

   // each interval storage lets one chunk through, which resets the stall timer every time.
   const drip = async (chunkBytes: number, intervals: number) => {
      const abortController = new AbortController();
      const body = new PassThrough();
      const floor = progressFloor({
         abortController,
         windowMs: WINDOW_MS,
         body,
         stall: { pausedMs: SPAN_MS, endedMs: () => SPAN_MS },
      });
      floor.open();
      body.resume();
      body.pause();
      for (let tick = 0; tick < intervals; tick++) {
         await vi.advanceTimersByTimeAsync(WINDOW_MS - 2);
         body.resume();
         await vi.advanceTimersByTimeAsync(1);
         floor.add(chunkBytes);
         body.pause();
         await vi.advanceTimersByTimeAsync(1);
      }
      floor.stop();
      return abortController;
   };

   afterEach(() => vi.useRealTimers());

   it("aborts storage that accepts one chunk per interval below the floor", async () => {
      vi.useFakeTimers();
      const belowFloor =
         (STORAGE_FLOOR_BYTES_PER_SECOND * WINDOW_MS) / 1000 / 8;
      const { signal } = await drip(belowFloor, 8);
      expect(signal.reason).toBeInstanceOf(StorageStalledError);
   });

   it("lets storage that accepts the floor rate keep going", async () => {
      vi.useFakeTimers();
      const atFloor = (STORAGE_FLOOR_BYTES_PER_SECOND * WINDOW_MS) / 1000;
      const { signal } = await drip(atFloor, 12);
      expect(signal.aborted).toBe(false);
   });

   it("waits for a full span before judging the rate", async () => {
      vi.useFakeTimers();
      const { signal } = await drip(1, SPAN_MS / WINDOW_MS - 1);
      expect(signal.aborted).toBe(false);
   });

   it("leaves a body that was never paused to the client floor", async () => {
      vi.useFakeTimers();
      const abortController = new AbortController();
      const body = new PassThrough();
      const floor = progressFloor({
         abortController,
         windowMs: WINDOW_MS,
         floor: 1,
         body,
         stall: { pausedMs: SPAN_MS, endedMs: () => SPAN_MS },
      });
      floor.open();
      body.resume();
      for (let tick = 0; tick < 8; tick++) {
         floor.add(1);
         await vi.advanceTimersByTimeAsync(WINDOW_MS - 1);
      }
      expect(abortController.signal.aborted).toBe(false);
      floor.stop();
   });

   it("stops measuring once the body has ended", async () => {
      vi.useFakeTimers();
      const abortController = new AbortController();
      const body = new PassThrough();
      const floor = progressFloor({
         abortController,
         windowMs: WINDOW_MS,
         body,
         stall: { pausedMs: SPAN_MS, endedMs: () => 10 * SPAN_MS },
      });
      floor.open();
      body.resume();
      body.pause();
      body.resume();
      body.end();
      await vi.advanceTimersByTimeAsync(SPAN_MS * 3);
      expect(abortController.signal.aborted).toBe(false);
      floor.stop();
      expect(vi.getTimerCount()).toBe(0);
   });
});
