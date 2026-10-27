import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BATCH_KEYS, Role } from "@s3-viewer/shared";
import { useCreateObjectCommands } from "./useObjectCommands";
import { downloadFromStorage } from "@/lib/utils/download";
import { getDownloadUrl } from "@/lib/utils/s3/presign";

const h = vi.hoisted(() => ({
   role: "EDITOR",
   capable: true,
   rename: vi.fn(),
   copy: vi.fn(),
   createFolder: vi.fn(),
   move: vi.fn(),
   transfer: vi.fn(),
   bulkRename: vi.fn(),
   uploads: vi.fn(),
   archive: vi.fn(),
   settings: vi.fn(),
   remove: vi.fn(),
   refresh: vi.fn(),
   refreshBuckets: vi.fn(),
   mutating: vi.fn(),
   error: vi.fn(),
   preparing: false,
}));

vi.mock("react", async (original) => ({
   ...(await original<typeof import("react")>()),
   useMemo: (create: () => unknown) => create(),
   useCallback: (callback: unknown) => callback,
}));
vi.mock("@/lib/contexts/modal-context", () => ({
   useModalActions: () => ({
      openScoped: (type: string, props: unknown) =>
         ({
            renameObject: h.rename,
            copyObject: h.copy,
            createFolder: h.createFolder,
            moveObjects: h.move,
            transferObjects: h.transfer,
            bulkRename: h.bulkRename,
            incompleteUploads: h.uploads,
            objectSettings: h.settings,
            confirmDelete: h.remove,
         })[type]!(props),
   }),
}));
vi.mock("@/lib/hooks/queries/server/useSessionServer", () => ({
   default: () => ({
      currentServer: {
         capabilities: {
            writable: h.capable,
            notice: null,
         },
      },
   }),
}));
vi.mock("@/lib/hooks/usePermission", async (original) => ({
   ...(await original<typeof import("@/lib/hooks/usePermission")>()),
   useEffectiveRoleState: () => ({ role: h.role, pending: false }),
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: { serverId: string }) => unknown) =>
      select({ serverId: "connected-server" }),
   useUserId: () => "user-1",
}));
vi.mock("@/lib/hooks/mutations/object/useArchiveDownload", () => ({
   default: () => ({ mutate: h.archive, isPending: false }),
   ARCHIVE_MUTATION_KEY: ["archive-download"],
}));
vi.mock("@tanstack/react-query", () => ({
   useIsMutating: (filters: unknown) => {
      h.mutating(filters);
      return h.preparing ? 1 : 0;
   },
}));
vi.mock("./Context", () => ({
   useBucketContext: () => ({
      refresh: h.refreshBuckets,
      reloadListing: h.refresh,
   }),
}));
vi.mock("@/lib/utils/download", () => ({ downloadFromStorage: vi.fn() }));
vi.mock("@/lib/utils/s3/presign", () => ({ getDownloadUrl: vi.fn() }));
vi.mock("@/lib/utils/toast", () => ({ toastError: vi.fn() }));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({ error: h.error })
);

beforeEach(() => {
   vi.clearAllMocks();
   h.role = Role.EDITOR;
   h.capable = true;
   h.preparing = false;
});

describe("object commands", () => {
   it("offers every mutation an editor is allowed to run", () => {
      const commands = useCreateObjectCommands("backups");
      expect(commands.can).toEqual({
         download: true,
         rename: true,
         upload: true,
         delete: true,
      });
      const opened = expect.objectContaining({
         serverId: "connected-server",
         bucketName: "backups",
      });
      commands.rename("old.txt", '"reviewed"');
      expect(h.rename).toHaveBeenCalledWith(opened);
      commands.copy("old.txt", '"reviewed"');
      expect(h.copy).toHaveBeenCalledWith(opened);
      commands.createFolder("reports/");
      expect(h.createFolder).toHaveBeenCalledWith(opened);
      commands.moveMany({ folderKey: "reports/" });
      expect(h.move).toHaveBeenCalledWith(opened);
      commands.transfer({ folderKey: "reports/" });
      expect(h.transfer).toHaveBeenCalledWith(opened);
      commands.bulkRename({ folderKey: "reports/" });
      expect(h.bulkRename).toHaveBeenCalledWith(opened);
      commands.incompleteUploads("reports/");
      expect(h.uploads).toHaveBeenCalledWith(opened);
      commands.downloadZip(["reports/"]);
      expect(h.archive).toHaveBeenCalledWith(
         expect.objectContaining({
            userId: "user-1",
            serverId: "connected-server",
            bucketName: "backups",
            objectKeys: ["reports/"],
         })
      );
      commands.editSettings("old.txt", '"reviewed"');
      expect(h.settings).toHaveBeenCalledWith(opened);
      commands.remove([{ key: "old.txt", expectedETag: '"reviewed"' }]);
      expect(h.remove).toHaveBeenCalledWith(opened);
   });

   it("follows the provider's capabilities when storage cannot mutate", () => {
      h.capable = false;
      const commands = useCreateObjectCommands("backups");
      expect(commands.can).toEqual({
         download: true,
         rename: false,
         upload: false,
         delete: false,
      });
      commands.rename("old.txt", '"reviewed"');
      commands.copy("old.txt", '"reviewed"');
      commands.createFolder("reports/");
      commands.moveMany({ folderKey: "reports/" });
      commands.editSettings("old.txt", '"reviewed"');
      commands.bulkRename({ folderKey: "reports/" });
      commands.incompleteUploads("reports/");
      commands.remove([{ key: "old.txt", expectedETag: '"reviewed"' }]);
      expect(h.bulkRename).not.toHaveBeenCalled();
      expect(h.uploads).not.toHaveBeenCalled();
      expect(h.rename).not.toHaveBeenCalled();
      expect(h.copy).not.toHaveBeenCalled();
      expect(h.createFolder).not.toHaveBeenCalled();
      expect(h.move).not.toHaveBeenCalled();
      expect(h.settings).not.toHaveBeenCalled();
      expect(h.remove).not.toHaveBeenCalled();

      commands.transfer({ folderKey: "reports/" });
      expect(h.transfer).toHaveBeenCalled();
      commands.downloadZip(["reports/"]);
      expect(h.archive).toHaveBeenCalled();
   });

   it("preserves viewer restrictions", () => {
      h.role = Role.VIEWER;
      expect(useCreateObjectCommands("backups").can).toEqual({
         download: true,
         rename: false,
         upload: false,
         delete: false,
      });
      useCreateObjectCommands("backups").rename("old.txt", '"reviewed"');
      useCreateObjectCommands("backups").copy("old.txt", '"reviewed"');
      useCreateObjectCommands("backups").editSettings("old.txt", '"reviewed"');
      useCreateObjectCommands("backups").bulkRename({
         folderKey: "reports/",
      });
      useCreateObjectCommands("backups").incompleteUploads("reports/");
      useCreateObjectCommands("backups").downloadZip(["a.txt"]);
      expect(h.bulkRename).not.toHaveBeenCalled();
      expect(h.uploads).not.toHaveBeenCalled();
      expect(h.archive).toHaveBeenCalled();
      useCreateObjectCommands("backups").remove([
         { key: "old.txt", expectedETag: '"reviewed"' },
      ]);
      expect(h.rename).not.toHaveBeenCalled();
      expect(h.copy).not.toHaveBeenCalled();
      expect(h.settings).not.toHaveBeenCalled();
      expect(h.remove).not.toHaveBeenCalled();
   });

   it.each([null, "*", '"*"', 'W/"old"', ""])(
      "does not rewrite an object without a valid observed ETag: %s",
      (expectedETag) => {
         useCreateObjectCommands("backups").rename("old.txt", expectedETag);
         useCreateObjectCommands("backups").copy("old.txt", expectedETag);
         useCreateObjectCommands("backups").editSettings(
            "old.txt",
            expectedETag
         );
         expect(h.rename).not.toHaveBeenCalled();
         expect(h.copy).not.toHaveBeenCalled();
         expect(h.settings).not.toHaveBeenCalled();
         expect(h.error).toHaveBeenCalledWith(
            expect.stringContaining("Refresh and review")
         );
      }
   );
});

describe("zipping a selection", () => {
   const keys = (total: number) =>
      Array.from({ length: total }, (_unused, index) => `photos/${index}.jpg`);

   it("asks for one ticket for the whole selection", () => {
      useCreateObjectCommands("backups").downloadZip(keys(MAX_BATCH_KEYS));
      expect(h.archive).toHaveBeenCalledWith(
         expect.objectContaining({ objectKeys: keys(MAX_BATCH_KEYS) })
      );
   });

   it("refuses a selection larger than one request instead of trimming it", () => {
      useCreateObjectCommands("backups").downloadZip(keys(MAX_BATCH_KEYS + 1));
      expect(h.archive).not.toHaveBeenCalled();
      expect(h.error).toHaveBeenCalledWith(
         `Select up to ${MAX_BATCH_KEYS} items for one zip`
      );
   });

   it("ignores a second click while any toolbar, row or header is cutting a ticket", () => {
      h.preparing = true;
      const commands = useCreateObjectCommands("backups");
      expect(h.mutating).toHaveBeenCalledWith({
         mutationKey: ["archive-download"],
      });
      expect(commands.isPreparingZip).toBe(true);
      commands.downloadZip(["photos/one.jpg"]);
      expect(h.archive).not.toHaveBeenCalled();
   });
});

describe("downloading an object", () => {
   it("hands the presigned url to a storage download, not an anchor", async () => {
      vi.mocked(getDownloadUrl).mockResolvedValue({
         url: "https://storage.test/report.pdf?X-Amz-Signature=sig",
      } as Awaited<ReturnType<typeof getDownloadUrl>>);
      await useCreateObjectCommands("bucket").download("docs/report.pdf");
      expect(downloadFromStorage).toHaveBeenCalledExactlyOnceWith(
         "https://storage.test/report.pdf?X-Amz-Signature=sig"
      );
   });
});

describe("browser-normalized object keys", () => {
   it("downloads the exact object as a zip without requesting an unsafe URL", async () => {
      await useCreateObjectCommands("bucket").download("a/../private.txt");
      expect(h.archive).toHaveBeenCalledWith({
         userId: "user-1",
         serverId: "connected-server",
         bucketName: "bucket",
         objectKeys: ["a/../private.txt"],
      });
      expect(getDownloadUrl).not.toHaveBeenCalled();
   });

   it("does not offer an unsafe share URL or repeat an active zip request", async () => {
      h.preparing = true;
      const commands = useCreateObjectCommands("bucket");
      await commands.copyLink("./private.txt");
      await commands.download("./private.txt");
      expect(getDownloadUrl).not.toHaveBeenCalled();
      expect(h.archive).not.toHaveBeenCalled();
   });
});

describe("after an object mutation settles", () => {
   it("reloads the listing without refetching the bucket list", () => {
      const done = vi.fn();
      useCreateObjectCommands("backups").remove(
         [{ key: "a.txt", expectedETag: null }],
         done
      );
      const { onDeleteSuccess } = h.remove.mock.calls[0]![0] as {
         onDeleteSuccess: () => void;
      };
      onDeleteSuccess();
      expect(h.refresh).toHaveBeenCalledOnce();
      expect(h.refreshBuckets).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalledOnce();
   });
});

describe("moving objects", () => {
   it("reloads the listing once for a clean move and passes the destination on", () => {
      const onSuccess = vi.fn();
      useCreateObjectCommands("backups").moveMany(
         { folderKey: "reports/" },
         onSuccess
      );
      const opened = h.move.mock.calls[0]?.[0] as {
         onMoved: () => void;
         onMoveComplete: (destination: string) => void;
      };
      opened.onMoved();
      opened.onMoveComplete("archive/");
      expect(h.refresh).toHaveBeenCalledOnce();
      expect(onSuccess).toHaveBeenCalledExactlyOnceWith("archive/");
   });
});
