// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { S3ObjectPreview } from "@s3-viewer/types";
import { flushRuntime, mountRuntime } from "@/lib/test/runtime";
import useObjectBody from "./useObjectBody";

const h = vi.hoisted(() => ({
   userId: "user-a",
   serverId: "server-a",
   objectKey: "one.json",
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: Object.assign((select: (state: typeof h) => unknown) => select(h), {
      getState: () => h,
   }),
   useUserId: () => h.userId,
}));
const preview: S3ObjectPreview = {
   url: "https://storage.test/a",
   expiresAt: "2026-01-01T00:00:00Z",
   contentType: "application/json",
   contentLength: 7,
   eTag: '"one"',
   versionId: null,
   lastModified: null,
   storageClass: null,
   cacheControl: null,
   contentDisposition: null,
   contentEncoding: null,
   contentLanguage: null,
   expires: null,
   metadata: {},
   serverSideEncryption: null,
   sseKmsKeyId: null,
};
let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
let update!: (preview: S3ObjectPreview) => void;
let result!: ReturnType<typeof useObjectBody>;
let initial = preview;
const Probe = () => {
   const [value, setValue] = useState(initial);
   update = setValue;
   result = useObjectBody("bucket", h.objectKey, value);
   return createElement("output", null, result.data ?? result.status);
};
const settle = async () => {
   await flushRuntime();
   await flushRuntime();
};
beforeEach(() => {
   h.userId = "user-a";
   h.serverId = "server-a";
   h.objectKey = "one.json";
   initial = preview;
   vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => new Response(JSON.stringify({ url })))
   );
});
afterEach(async () => {
   await runtime?.unmount();
   runtime?.queryClient.clear();
   runtime = undefined;
   vi.restoreAllMocks();
   vi.unstubAllGlobals();
});

describe("version-scoped JSON previews", () => {
   it("replaces the bytes on a changed ETag, retaining them for a signature renewal", async () => {
      runtime = await mountRuntime(createElement(Probe));
      await settle();
      expect(result.data).toContain("storage.test/a");
      const completedCalls = vi.mocked(fetch).mock.calls.length;
      await act(async () =>
         update({ ...preview, url: "https://storage.test/renewed" })
      );
      await settle();
      expect(fetch).toHaveBeenCalledTimes(completedCalls);
      expect(result.data).toContain("storage.test/a");
      await act(async () =>
         update({ ...preview, eTag: '"two"', url: "https://storage.test/b" })
      );
      await settle();
      expect(result.data).toContain("storage.test/b");
      expect(fetch).toHaveBeenCalledTimes(completedCalls + 1);
   });

   it("refetches a changed version even when its ETag is unchanged", async () => {
      runtime = await mountRuntime(createElement(Probe));
      await settle();
      await act(async () =>
         update({
            ...preview,
            versionId: "version-2",
            url: "https://storage.test/b",
         })
      );
      await settle();
      expect(result.data).toContain("storage.test/b");
   });

   it.each(['"one"', null])(
      "refetches the decoded representation after an external encoding change (ETag: %s)",
      async (eTag) => {
         vi.mocked(fetch).mockImplementation(
            async () => new Response("compressed bytes")
         );
         runtime = await mountRuntime(createElement(Probe));
         await act(async () => update({ ...preview, eTag }));
         await settle();
         expect(result.data).toBe("compressed bytes");
         const completedCalls = vi.mocked(fetch).mock.calls.length;
         vi.mocked(fetch).mockImplementation(
            async () => new Response('{"decoded":true}')
         );
         await act(async () =>
            update({ ...preview, eTag, contentEncoding: "gzip" })
         );
         await settle();
         expect(result.data).toBe('{"decoded":true}');
         expect(fetch).toHaveBeenCalledTimes(completedCalls + 1);
      }
   );

   it("recovers an expired-link failure when a fresh URL arrives", async () => {
      vi.mocked(fetch).mockImplementation(
         async (input) =>
            new Response(
               String(input).endsWith("/a") ? "Expired" : '{"fresh":true}',
               { status: String(input).endsWith("/a") ? 403 : 200 }
            )
      );
      runtime = await mountRuntime(createElement(Probe));
      await settle();
      expect(result.isError).toBe(true);
      await act(async () =>
         update({ ...preview, url: "https://storage.test/renewed" })
      );
      await settle();
      expect(result.data).toBe('{"fresh":true}');
   });

   it.each<Record<string, string>>([
      { etag: '"replacement"' },
      { "x-amz-version-id": "replacement" },
   ])("rejects bytes from a replacement exposed by %j", async (headers) => {
      vi.mocked(fetch).mockImplementation(
         async () => new Response('{"replacement":true}', { headers })
      );
      runtime = await mountRuntime(createElement(Probe));
      await act(async () => update({ ...preview, versionId: "reviewed" }));
      await settle();
      expect(result.data).toBeUndefined();
      expect(result.error?.message).toContain("object changed");
      expect(result.error).toMatchObject({ changed: true });
   });

   it("accepts a strong ETag a compressing proxy weakened", async () => {
      vi.mocked(fetch).mockImplementation(
         async () =>
            new Response('{"same":true}', { headers: { etag: 'W/"one"' } })
      );
      runtime = await mountRuntime(createElement(Probe));
      await settle();
      expect(result.data).toBe('{"same":true}');
   });

   it.each(["userId", "serverId", "objectKey"] as const)(
      "isolates bodies when %s changes",
      async (field) => {
         runtime = await mountRuntime(createElement(Probe));
         await settle();
         const completedCalls = vi.mocked(fetch).mock.calls.length;
         h[field] = "other";
         await act(async () =>
            update({ ...preview, url: "https://storage.test/other" })
         );
         await settle();
         expect(fetch).toHaveBeenCalledTimes(completedCalls + 1);
         expect(result.data).toContain("storage.test/other");
      }
   );

   describe("when the bucket has no CORS rule for the app", () => {
      const blocked = (api: () => Response) =>
         vi.mocked(fetch).mockImplementation(async (input) => {
            if (String(input).startsWith("https://storage.test"))
               throw new TypeError("Failed to fetch");
            return api();
         });
      const apiCalls = () =>
         vi
            .mocked(fetch)
            .mock.calls.filter(
               ([input]) => !String(input).startsWith("https://storage.test")
            );

      it("reads the body through the API and drops a byte-order mark", async () => {
         blocked(
            () =>
               new Response(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), {
                  headers: { ETag: '"one"' },
               })
         );
         runtime = await mountRuntime(createElement(Probe));
         await settle();
         expect(result.data).toBe("{}");
         expect(apiCalls()).toHaveLength(1);
         expect(String(apiCalls()[0]![0])).toContain("objectKey=one.json");
      });

      it("accepts the API's ETag weakened by a compressing proxy", async () => {
         blocked(() => new Response("{}", { headers: { ETag: 'W/"one"' } }));
         runtime = await mountRuntime(createElement(Probe));
         await settle();
         expect(result.data).toBe("{}");
      });

      it("rejects a body the API read from a replaced object", async () => {
         blocked(
            () => new Response("{}", { headers: { ETag: '"replacement"' } })
         );
         runtime = await mountRuntime(createElement(Probe));
         await settle();
         expect(result.data).toBeUndefined();
         expect(result.error).toMatchObject({ changed: true });
      });

      it.each([
         { contentLength: 1024 * 1024 + 1 },
         { contentEncoding: "gzip" },
      ])("keeps the iframe fallback for %j", async (change) => {
         blocked(() => new Response("{}"));
         initial = { ...preview, ...change };
         runtime = await mountRuntime(createElement(Probe));
         await settle();
         expect(result.isError).toBe(true);
         expect(apiCalls()).toHaveLength(0);
      });

      it("does not use the API when storage answers with an error status", async () => {
         vi.mocked(fetch).mockImplementation(
            async () => new Response("Expired", { status: 403 })
         );
         runtime = await mountRuntime(createElement(Probe));
         await settle();
         expect(result.isError).toBe(true);
         expect(apiCalls()).toHaveLength(0);
      });
   });

   it("aborts a pending body when its observer unmounts", async () => {
      const signals: AbortSignal[] = [];
      vi.mocked(fetch).mockImplementation(
         (_url, init) =>
            new Promise((_resolve, reject) => {
               const signal = init!.signal!;
               signals.push(signal);
               signal.addEventListener("abort", () => reject(signal.reason), {
                  once: true,
               });
            })
      );
      runtime = await mountRuntime(createElement(Probe));
      await runtime.unmount();
      expect(signals.length).toBeGreaterThan(0);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
   });
});
