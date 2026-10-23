// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import type { S3ObjectSettings } from "@s3-viewer/types";
import Modal from "./index";

type SettingsResult = {
   data: S3ObjectSettings | undefined;
   isFetching: boolean;
   dataUpdatedAt: number;
   error: Error | null;
};

const h = vi.hoisted(() => ({
   settings: null as unknown as SettingsResult,
   options: undefined as unknown,
   rerender: () => {},
}));

vi.mock("@s3-viewer/ui/components/dialog", async () =>
   (await import("@/components/test-helpers")).passthroughDialog()
);
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock()
);
vi.mock("@/lib/hooks/mutations/object/useUpdateObjectSettings", () => ({
   default: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/lib/hooks/queries/s3/useObjectSettings", async () => {
   const { useReducer } = await import("react");
   const useObjectSettings = (
      _bucket: string,
      _key: string,
      options: unknown
   ) => {
      h.options = options;
      const [, bump] = useReducer((count: number) => count + 1, 0);
      h.rerender = bump;
      return h.settings;
   };
   return { default: useObjectSettings };
});

const settings = (contentType: string): S3ObjectSettings => ({
   contentType,
   contentLength: 1,
   lastModified: null,
   storageClass: null,
   eTag: '"same"',
   cacheControl: null,
   contentDisposition: null,
   contentEncoding: null,
   contentLanguage: null,
   expires: null,
   metadata: {},
   serverSideEncryption: null,
   sseKmsKeyId: null,
   versionId: null,
});

const view = mountedRuntime();
const input = () =>
   view.current.container.querySelector<HTMLInputElement>("input");
const open = () =>
   view.mount(
      createElement(Modal, {
         onClose: vi.fn(),
         userId: "user1",
         serverId: "server1",
         bucketName: "bucket",
         objectKey: "a.txt",
         expectedETag: '"same"',
      })
   );
const answer = async (result: Partial<SettingsResult>) => {
   h.settings = { ...h.settings, ...result };
   await act(async () => h.rerender());
};

beforeEach(() => {
   h.settings = {
      data: settings("text/old"),
      isFetching: true,
      dataUpdatedAt: Date.now() - 60_000,
      error: null,
   };
});

describe("object settings form", () => {
   it("waits for a read made after opening instead of seeding from the cache", async () => {
      await open();
      expect(h.options).toEqual({ fresh: true });
      expect(input()).toBeNull();
      expect(view.text()).toContain("Loading settings");
      await answer({
         data: settings("text/new"),
         isFetching: false,
         dataUpdatedAt: Date.now() + 1,
      });
      expect(input()?.value).toBe("text/new");
      await answer({ data: settings("text/later"), isFetching: true });
      await answer({ isFetching: false, dataUpdatedAt: Date.now() + 2 });
      expect(input()?.value).toBe("text/new");
   });

   it("shows the failed read rather than the cached settings", async () => {
      await open();
      await answer({ isFetching: false, error: new Error("Access denied") });
      expect(input()).toBeNull();
      expect(view.text()).toContain("Access denied");
   });
});
