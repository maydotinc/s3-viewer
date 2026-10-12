import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BATCH_KEYS, Provider, Role } from "@s3-viewer/types";
import { useCreateObjectCommands } from "./useObjectCommands";
import { getDownloadUrl } from "@/lib/utils/s3/presign";

const h = vi.hoisted(() => ({
   provider: "S3",
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
vi.mock("@/lib/hooks/queries/server/useCurrentServer", () => ({
   default: () => ({
      currentServer: {
         provider: h.provider,
         capabilities: {
            upload: h.capable,
            replace: h.capable,
            rename: h.capable,
            delete: h.capable,
            notice: null,
         },
      },
   }),
}));
vi.mock("@/lib/hooks/usePermission", () => ({
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
vi.mock("@/lib/utils/download", () => ({ downloadUrl: vi.fn() }));
vi.mock("@/lib/utils/s3/presign", () => ({ getDownloadUrl: vi.fn() }));
vi.mock("@/lib/utils/toast", () => ({ toastError: vi.fn() }));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({ error: h.error })
);

beforeEach(() => {
   vi.clearAllMocks();
   h.capable = true;
   h.preparing = false;
});

describe.each([Provider.S3, Provider.R2, Provider.Other])(
   "object commands on %s",
   (provider) => {
      it("offers every mutation an editor is allowed to run", () => {
         h.provider = provider;
         h.role = Role.EDITOR;
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
         h.provider = provider;
         h.role = Role.EDITOR;
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

      it("preserves viewer restrictions regardless of storage provider", () => {
         h.provider = provider;
         h.role = Role.VIEWER;
         expect(useCreateObjectCommands("backups").can).toEqual({
            download: true,
            rename: false,
            upload: false,
            delete: false,
         });
         useCreateObjectCommands("backups").rename("old.txt", '"reviewed"');
         useCreateObjectCommands("backups").copy("old.txt", '"reviewed"');
         useCreateObjectCommands("backups").editSettings(
            "old.txt",
            '"reviewed"'
         );
         useCreateObjectCommands("backups").bulkRename({
            folderKey: "reports/",
         });
         useCreateObjectCommands("backups").incompleteUploads("reports/");
         useCreateObjectCommands("backups").downloadZip([]);
         expect(h.bulkRename).not.toHaveBeenCalled();
         expect(h.uploads).not.toHaveBeenCalled();
         expect(h.archive).not.toHaveBeenCalled();
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
            h.provider = provider;
            h.role = Role.EDITOR;
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
   }
);

describe("zipping a selection", () => {
   const keys = (total: number) =>
      Array.from({ length: total }, (_unused, index) => `photos/${index}.jpg`);

   beforeEach(() => {
      h.provider = Provider.S3;
      h.role = Role.EDITOR;
   });

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
      h.role = Role.EDITOR;
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

   it("gives the move dialog the listing reload for each moved batch", () => {
      h.role = Role.EDITOR;
      useCreateObjectCommands("backups").moveMany({ folderKey: "reports/" });
      expect(h.move.mock.calls[0]![0]).toMatchObject({ onMoved: h.refresh });
      expect(h.refreshBuckets).not.toHaveBeenCalled();
   });
});

describe("moving objects", () => {
   it("reloads the listing once for a clean move and passes the destination on", () => {
      h.provider = Provider.S3;
      h.role = Role.EDITOR;
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
