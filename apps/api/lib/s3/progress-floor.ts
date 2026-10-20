import { Transform, type Readable } from "node:stream";
import {
   STORAGE_FLOOR_BYTES_PER_SECOND,
   UPLOAD_FLOOR_BYTES_PER_SECOND,
   uploadMemoryFor,
} from "@/lib/constants";
import { SECOND_MS } from "@s3-viewer/types";

const MAX_TIMER_MS = 2 ** 31 - 1;

class UploadIdleError extends Error {
   constructor(message = "Upload stopped receiving data. Try again.") {
      super(message);
      this.name = "UploadIdleError";
   }
}

// subclassing the idle error lets every streaming path surface it as the abort reason.
class SlotExpiredError extends UploadIdleError {
   constructor() {
      super(
         "Upload took too long. Try again on a faster connection or in smaller parts."
      );
      this.name = "SlotExpiredError";
   }
}

class StorageStalledError extends Error {
   constructor() {
      super("Storage stopped accepting data. Try again later.");
      this.name = "StorageStalledError";
   }
}

type StallLimits = { pausedMs: number; endedMs: () => number };

// parts reach storage whole, so a store draining at exactly the floor still moves the body in lumps of up to one part;
// the span already holds four parts' worth of floor, so half of it clears one lump of error with room to spare.
const STORAGE_RATE_TOLERANCE = 1 / 2;

type ProgressFloorArgs = {
   abortController: AbortController;
   windowMs: number;
   floor?: number;
   body?: Readable;
   stall?: StallLimits;
};

type ProgressFloor = {
   add: (units: number) => void;
   open: () => void;
   stop: () => void;
};

const progressFloor = ({
   abortController,
   windowMs,
   floor = 0,
   body,
   stall,
}: ProgressFloorArgs): ProgressFloor => {
   let seen = 0;
   let timer: ReturnType<typeof setTimeout> | undefined;
   let stallTimer: ReturnType<typeof setTimeout> | undefined;
   let stopped = false;
   let rateTimer: ReturnType<typeof setInterval> | undefined;
   let bucket = { units: 0, pausedMs: 0 };
   let pausedSince: number | undefined;
   const buckets: (typeof bucket)[] = [];
   const clear = (): void => {
      clearTimeout(timer);
      timer = undefined;
   };
   const stopRate = (): void => {
      clearInterval(rateTimer);
      rateTimer = undefined;
   };
   // a pause that resumes after every drip resets the stall timer, so the rate over wall time is what bounds a dripping store.
   const checkRate = (spanLimitMs: number): void => {
      const now = Date.now();
      if (pausedSince !== undefined) {
         bucket.pausedMs += now - pausedSince;
         pausedSince = now;
      }
      buckets.push(bucket);
      bucket = { units: 0, pausedMs: 0 };
      const wanted = Math.ceil(spanLimitMs / windowMs);
      if (buckets.length > wanted) buckets.shift();
      if (buckets.length < wanted) return;
      const spanMs = wanted * windowMs;
      const paused = buckets.reduce((sum, { pausedMs }) => sum + pausedMs, 0);
      const moved = buckets.reduce((sum, { units }) => sum + units, 0);
      if (
         paused * 2 >= spanMs &&
         moved <
            ((STORAGE_FLOOR_BYTES_PER_SECOND * spanMs) / SECOND_MS) *
               STORAGE_RATE_TOLERANCE
      )
         abortController.abort(new StorageStalledError());
   };
   const startRate = (): void => {
      if (!stall || stopped || rateTimer !== undefined) return;
      const { pausedMs } = stall;
      rateTimer = setInterval(() => checkRate(pausedMs), windowMs);
      rateTimer.unref();
   };
   const disarm = (): void => {
      clearTimeout(stallTimer);
      stallTimer = undefined;
   };
   const arm = (ms: number): void => {
      if (stopped || stallTimer !== undefined) return;
      stallTimer = setTimeout(
         () => abortController.abort(new StorageStalledError()),
         Math.min(ms, MAX_TIMER_MS)
      );
      stallTimer.unref();
   };
   const open = (): void => {
      clear();
      if (stopped || (body && (!body.readableFlowing || body.readableEnded)))
         return;
      seen = 0;
      timer = setTimeout(() => {
         if (seen === 0 || seen < floor) {
            abortController.abort(new UploadIdleError());
            return;
         }
         open();
      }, windowMs);
      timer.unref();
   };
   const onPause = (): void => {
      clear();
      pausedSince ??= Date.now();
      if (stall) arm(stall.pausedMs);
   };
   const onResume = (): void => {
      if (pausedSince !== undefined) {
         bucket.pausedMs += Date.now() - pausedSince;
         pausedSince = undefined;
      }
      if (body?.readableFlowing) disarm();
      open();
   };
   const unlisten = (): void => {
      body?.off("pause", onPause);
      body?.off("resume", onResume);
      body?.off("end", onEnd);
   };
   const stop = (): void => {
      stopped = true;
      clear();
      disarm();
      stopRate();
      unlisten();
   };
   const onEnd = (): void => {
      if (!stall) return stop();
      clear();
      disarm();
      stopRate();
      unlisten();
      arm(stall.endedMs());
   };
   body?.on("pause", onPause);
   body?.on("resume", onResume);
   body?.on("end", onEnd);
   startRate();
   return {
      add: (units) => {
         seen += units;
         bucket.units += units;
      },
      open,
      stop,
   };
};

const floorBytesFor = (windowMs: number): number =>
   (windowMs / SECOND_MS) * UPLOAD_FLOOR_BYTES_PER_SECOND;

const stallMsFor = (windowMs: number, partSize: number): number =>
   windowMs +
   (uploadMemoryFor(partSize) / STORAGE_FLOOR_BYTES_PER_SECOND) * SECOND_MS;

const floorGuard = (
   abortController: AbortController,
   windowMs: number,
   body: Readable,
   partSize: number
): Transform => {
   const stalledAfterMs = stallMsFor(windowMs, partSize);
   const floor = progressFloor({
      abortController,
      windowMs,
      floor: floorBytesFor(windowMs),
      body,
      stall: { pausedMs: stalledAfterMs, endedMs: () => stalledAfterMs },
   });
   floor.open();
   return new Transform({
      transform(chunk: Buffer, _encoding, done) {
         floor.add(chunk.length);
         done(null, chunk);
      },
      destroy(error, done) {
         floor.stop();
         done(error);
      },
   });
};

export {
   floorBytesFor,
   floorGuard,
   progressFloor,
   SlotExpiredError,
   stallMsFor,
   StorageStalledError,
   UploadIdleError,
};
