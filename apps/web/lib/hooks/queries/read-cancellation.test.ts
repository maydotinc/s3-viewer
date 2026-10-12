// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { mountRuntime } from "@/lib/test/runtime";
import useObjectKeys from "./s3/useObjectKeys";
import useMultipartUploads from "./s3/useMultipartUploads";
import useMembers from "./server/useMembers";
import useAuditLog from "./server/useAuditLog";
import useAuditSettings from "./server/useAuditSettings";
import { useAccountSummary } from "./user/useAccountSummary";

vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: { serverId: string }) => unknown) =>
      select({ serverId: "server" }),
   useUserId: () => "user",
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: vi.fn() },
}));

const probes = {
   Suggestions: () => {
      useObjectKeys("bucket", "prefix", true);
      return null;
   },
   Multipart: () => {
      useMultipartUploads("server", "bucket", "prefix");
      return null;
   },
   Members: () => {
      useMembers("server");
      return null;
   },
   Audit: () => {
      useAuditLog("server", {});
      return null;
   },
   AuditSettings: () => {
      useAuditSettings("server");
      return null;
   },
   AccountSummary: () => {
      useAccountSummary();
      return null;
   },
};
let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
let requests: { path: string; signal: AbortSignal | undefined }[];
beforeEach(() => {
   requests = [];
   vi.mocked(api.get)
      .mockReset()
      .mockImplementation(
         (path, signal) =>
            new Promise((_resolve, reject) => {
               requests.push({ path, signal });
               signal?.addEventListener("abort", () => reject(signal.reason), {
                  once: true,
               });
            })
      );
});
afterEach(async () => {
   await runtime?.unmount();
   runtime?.queryClient.clear();
   runtime = undefined;
   vi.unstubAllGlobals();
});

describe("read query cancellation", () => {
   it.each(Object.entries(probes))(
      "cancels pending %s work when its last observer leaves",
      async (_name, Probe) => {
         runtime = await mountRuntime(createElement(Probe));
         await runtime.unmount();
         expect(requests.length).toBeGreaterThan(0);
         expect(requests.every(({ signal }) => signal?.aborted)).toBe(true);
      }
   );

   it("cancels superseded suggestions while retaining the current prefix request", async () => {
      let update!: (prefix: string) => void;
      const Probe = () => {
         const [prefix, setPrefix] = useState("old");
         update = setPrefix;
         useObjectKeys("bucket", prefix, true);
         return null;
      };
      runtime = await mountRuntime(createElement(Probe));
      await act(async () => update("new"));
      const old = requests.filter(({ path }) => path.includes("prefix=old"));
      const current = requests.filter(({ path }) =>
         path.includes("prefix=new")
      );
      expect(old.length).toBeGreaterThan(0);
      expect(old.every(({ signal }) => signal?.aborted)).toBe(true);
      expect(current.length).toBeGreaterThan(0);
      expect(current.some(({ signal }) => signal && !signal.aborted)).toBe(
         true
      );
   });
});
