import { S3_ROUTE_TIMEOUT_MS, copyWorkMs } from "@/lib/constants";
import type { HeadObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { GIB } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { fakeResponse } from "@/lib/testing/fake-response";
import { copyScope } from "./scope";

const scope = { client: {} as S3Client, bucket: "backups" };
const head = (ContentLength: number) =>
   ({ ContentLength, $metadata: {} }) as HeadObjectCommandOutput;

describe("copyScope", () => {
   it("budgets a multi-GiB copy well past the route timeout", () => {
      expect(copyWorkMs(10 * GIB)).toBeGreaterThan(10 * S3_ROUTE_TIMEOUT_MS);
      expect(copyWorkMs(5 * 1024 ** 4)).toBeLessThan(2 ** 31 - 1);
   });

   it("hands the idle socket timeout over to the sized deadline", () => {
      const res = fakeResponse();
      copyScope(scope, res, head(10 * GIB));
      expect(res.req.setTimeout).toHaveBeenCalledExactlyOnceWith(0);
   });

   it("does not let the completed setup deadline abort a sized copy", () => {
      const setup = new AbortController();
      const res = fakeResponse();
      const sized = copyScope(
         { ...scope, signal: setup.signal },
         res,
         head(10 * GIB)
      );
      setup.abort(new DOMException("Setup deadline elapsed", "TimeoutError"));
      expect(sized.signal?.aborted).toBe(false);
      res.emit("close");
      expect(sized.signal?.aborted).toBe(true);
   });

   it("does not abort for a response that closed after finishing", () => {
      const res = fakeResponse();
      const sized = copyScope(scope, res, head(4));
      res.writableEnded = true;
      res.emit("close");
      expect(sized.signal?.aborted).toBe(false);
   });
});
