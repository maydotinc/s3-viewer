// @vitest-environment happy-dom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushRuntime, mountRuntime } from "@/lib/test/runtime";
import useBucketsForServer from "./useBucketsForServer";
import useBuckets from "./useBuckets";

const h = vi.hoisted(() => ({
   userId: "user",
   serverId: "server",
   get: vi.fn(),
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: typeof h) => unknown) => select(h),
   useUserId: () => h.userId,
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get },
}));

let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
let selected!: ReturnType<typeof useBuckets>;
let destination!: ReturnType<typeof useBucketsForServer>;
const Probe = () => {
   selected = useBuckets("photos");
   destination = useBucketsForServer(h.userId, h.serverId);
   return null;
};
beforeEach(() => {
   h.userId = "user";
   h.serverId = "server";
   h.get.mockReset();
});
afterEach(async () => {
   await runtime?.unmount();
   runtime?.queryClient.clear();
   runtime = undefined;
   vi.unstubAllGlobals();
});

describe("shared bucket reads", () => {
   it.each(["userId", "serverId"] as const)(
      "does not report loading without %s",
      async (field) => {
         h[field] = "";
         runtime = await mountRuntime(createElement(Probe));
         expect(selected.isBucketsLoading).toBe(false);
         expect(destination.isLoading).toBe(false);
         expect(h.get).not.toHaveBeenCalled();
      }
   );

   it("shares one active request and cancels it after both consumers unmount", async () => {
      const signals: AbortSignal[] = [];
      h.get.mockImplementation((_path: string, signal: AbortSignal) => {
         signals.push(signal);
         return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), {
               once: true,
            });
         });
      });
      runtime = await mountRuntime(createElement(Probe));
      await flushRuntime();
      expect(signals.filter((signal) => !signal.aborted)).toHaveLength(1);
      expect(selected.isBucketsLoading).toBe(true);
      expect(destination.isLoading).toBe(true);
      await runtime.unmount();
      expect(signals.every((signal) => signal.aborted)).toBe(true);
   });

   it("shares bucket data while preserving selected-bucket lookup", async () => {
      const bucket = { name: "photos" };
      h.get.mockResolvedValue({ buckets: [bucket] });
      runtime = await mountRuntime(createElement(Probe));
      await flushRuntime();
      expect(selected.currentBucket).toEqual(bucket);
      expect(selected.buckets).toBe(destination.buckets);
      expect(selected.isBucketsLoading).toBe(false);
      expect(destination.isLoading).toBe(false);
   });
});
