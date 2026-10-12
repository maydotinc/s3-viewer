import * as React from "react";
import { one } from "@/lib/test/elements";
import type { KnownReach } from "@/lib/utils/folder-access";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   metadata: {
      contentType: "application/json",
      contentLength: 12,
      eTag: '"reviewed"',
      lastModified: null,
      storageClass: null,
   },
   key: "a/../config.json",
   error: null as Error | null,
   loading: false,
   available: true,
   previewAvailable: false,
   settings: vi.fn(),
   preview: vi.fn(),
   reach: { folders: null, owner: true } as KnownReach,
   refresh: vi.fn(),
   can: { download: true, upload: true },
}));
vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: () => [false, vi.fn()],
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: { serverId: string }) => unknown) =>
      select({ serverId: "server" }),
   useUserId: () => "user",
}));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({
      bucketName: "bucket",
      path: h.key.split("/"),
      notFound: false,
      reach: h.reach,
      refresh: h.refresh,
      isRefreshing: false,
   }),
}));
vi.mock("@/components/Buckets/useObjectCommands", () => ({
   ObjectCommandsProvider: "commands",
   useCreateObjectCommands: () => ({ can: h.can, isResolving: false }),
}));
vi.mock("@/lib/hooks/queries/s3/useObjectPreview", () => ({
   default: (...args: unknown[]) => {
      h.preview(...args);
      return {
         data: h.previewAvailable ? h.metadata : undefined,
         isPending: !h.previewAvailable,
         isError: false,
         error: null,
      };
   },
}));
vi.mock("@/lib/hooks/queries/s3/useObjectSettings", () => ({
   default: (...args: unknown[]) => {
      h.settings(...args);
      return {
         data: h.available ? h.metadata : undefined,
         isPending: h.loading,
         error: h.error,
      };
   },
}));
vi.mock("@/components/Layout/page", () => ({ Page: "main" }));
vi.mock("@/components/Buckets/unavailable", () => ({ default: "unavailable" }));
vi.mock("@/components/Buckets/folder-access", () => ({
   NoFolderAccess: "no-folder-access",
   DottedPath: "dotted-path",
}));
vi.mock("./details", () => ({ default: "details" }));
vi.mock("./editor", () => ({ default: "editor" }));
vi.mock("./header", () => ({ default: "header" }));
vi.mock("./lazy-preview", () => ({ LazyPreview: "preview" }));
import ObjectView from "./index";

const render = () => (ObjectView().type as () => React.ReactElement)();
beforeEach(() => {
   h.key = "a/../config.json";
   h.available = true;
   h.previewAvailable = false;
   h.settings.mockClear();
   h.preview.mockClear();
   h.reach = { folders: null, owner: true };
   h.loading = false;
   h.error = null;
   h.can = { download: true, upload: true };
});

describe("metadata for objects without a browser link", () => {
   it("retains the displayed ETag for object commands and renders loaded details", () => {
      const tree = render();
      expect(
         one(tree, (node) => node.type === "header", "header").props
      ).toMatchObject({
         eTag: '"reviewed"',
         metadataPending: false,
         canEdit: false,
      });
      expect(
         one(tree, (node) => node.type === "details", "details").props
      ).toMatchObject({ details: h.metadata, isLoading: false, error: null });
   });
   it("holds Delete until the ETag it should send has loaded", () => {
      h.available = false;
      h.loading = true;
      expect(
         one(render(), (node) => node.type === "header", "header").props
      ).toMatchObject({ eTag: null, metadataPending: true });
   });
   it("keeps delete-by-key available when the metadata request failed", () => {
      h.available = false;
      h.error = new Error("Storage unavailable");
      expect(
         one(render(), (node) => node.type === "header", "header").props
      ).toMatchObject({ eTag: null, metadataPending: false });
   });
   it("shows metadata errors rather than an indefinitely pending disabled preview", () => {
      h.available = false;
      h.error = new Error("Storage unavailable");
      const tree = render();
      expect(
         one(tree, (node) => node.type === "details", "details").props
      ).toMatchObject({
         details: undefined,
         isLoading: false,
         error: h.error,
      });
   });
});

describe("details for a role without download permission", () => {
   it("explains why details are missing instead of loading forever", () => {
      h.can = { download: false, upload: false };
      h.available = false;
      h.loading = true;
      const details = one(
         render(),
         (node) => node.type === "details",
         "details"
      ).props as { isLoading: boolean; error: Error | null };
      expect(h.settings).toHaveBeenLastCalledWith("bucket", h.key, false);
      expect(details.isLoading).toBe(false);
      expect(details.error?.message).toContain("can't download this file");
   });
});

describe("combined object metadata", () => {
   it("uses the preview settings and disables the redundant settings read for browser-safe keys", () => {
      h.key = "config.json";
      h.available = false;
      h.previewAvailable = true;
      const tree = render();
      expect(h.settings).toHaveBeenCalledExactlyOnceWith(
         "bucket",
         "config.json",
         false
      );
      expect(
         one(tree, (node) => node.type === "details", "details").props
      ).toMatchObject({
         details: h.metadata,
         isLoading: false,
      });
   });
   it("still enables standalone metadata for unsupported browser keys", () => {
      render();
      expect(h.settings).toHaveBeenCalledExactlyOnceWith(
         "bucket",
         "a/../config.json",
         true
      );
   });
});

describe("files outside someone's reach", () => {
   const only = (type: string) =>
      one(render(), (node) => node.type === type, type).props;

   it("shows the no-access state without asking for the file", () => {
      h.key = "private/report.pdf";
      h.reach = { folders: ["landing/"], owner: false };
      expect(only("no-folder-access")).toMatchObject({
         bucketName: "bucket",
         folders: ["landing/"],
         target: "file",
         onRetry: h.refresh,
      });
      expect(h.preview).toHaveBeenCalledExactlyOnceWith(
         "bucket",
         "private/report.pdf",
         false
      );
      expect(h.settings).toHaveBeenCalledExactlyOnceWith(
         "bucket",
         "private/report.pdf",
         false
      );
   });

   it("explains a dotted path instead of asking for it", () => {
      h.reach = { folders: null, owner: false };
      only("dotted-path");
      expect(h.preview).toHaveBeenCalledWith(
         "bucket",
         "a/../config.json",
         false
      );
      expect(h.settings).toHaveBeenCalledWith(
         "bucket",
         "a/../config.json",
         false
      );
   });

   it("waits for the bucket list before asking for anything", () => {
      h.key = "landing/index.html";
      h.reach = undefined;
      render();
      expect(h.preview).toHaveBeenCalledWith(
         "bucket",
         "landing/index.html",
         false
      );
   });

   it("reads a file inside someone's folders as usual", () => {
      h.key = "landing/index.html";
      h.reach = { folders: ["landing/"], owner: false };
      only("details");
      expect(h.preview).toHaveBeenCalledWith(
         "bucket",
         "landing/index.html",
         true
      );
   });
});
