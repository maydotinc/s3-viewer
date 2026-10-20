import { uploadSlot } from "@/lib/utils/s3/slot-pool";
import { MULTIPART_CONCURRENCY } from "@s3-viewer/types";
import { expect } from "vitest";

// the slot pool is a module singleton, so a slot one test leaks would starve every later test in the file.
const expectUploadSlotsFree = async (slot = uploadSlot) => {
   let started = 0;
   const probes = Array.from({ length: MULTIPART_CONCURRENCY }, (_, index) =>
      slot(`probe-${index}`, async () => {
         started++;
      })
   );
   expect(started).toBe(MULTIPART_CONCURRENCY);
   await Promise.all(probes);
};

export { expectUploadSlotsFree };
