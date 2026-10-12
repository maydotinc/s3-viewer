import { describe, expect, it } from "vitest";
import { sheetStatus } from "./upload-progress";

describe("the sheet's summary", () => {
   const batch = (total: number, completed: number, failed: number) => ({
      ids: Array.from({ length: total }, (_unused, index) => `${index}`),
      settled: true,
      completed,
      failed,
      refusal: null,
   });

   it.each([
      [true, batch(10, 3, 0), "uploading", "Uploading… (3/10)"],
      [false, batch(10, 10, 0), "complete", "Uploads complete"],
      [false, batch(10, 7, 3), "failed", "3 of 10 uploads failed"],
      [false, batch(10, 0, 0), "cancelled", "Uploads cancelled"],
      [false, batch(10, 4, 0), "cancelled", "6 of 10 uploads cancelled"],
      [false, null, "complete", "Uploads complete"],
   ] as const)(
      "uploading=%s %o reads %s",
      (isUploading, current, tone, heading) => {
         expect(sheetStatus(isUploading, current)).toEqual({ tone, heading });
      }
   );
});
