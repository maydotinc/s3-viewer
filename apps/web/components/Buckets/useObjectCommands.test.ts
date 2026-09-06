import { beforeEach, describe, expect, it, vi } from "vitest";
import { Provider, Role } from "@s3-viewer/types";
import useObjectCommands from "./useObjectCommands";

const h = vi.hoisted(() => ({
   provider: "S3",
   role: "EDITOR",
   rename: vi.fn(),
   remove: vi.fn(),
   refresh: vi.fn(),
   error: vi.fn(),
}));

vi.mock("react", () => ({
   useMemo: (create: () => unknown) => create(),
   useCallback: (callback: unknown) => callback,
}));
vi.mock("@/lib/contexts/ModalContext", () => ({
   useModalActions: () => ({
      openRenameObjectModal: h.rename,
      openConfirmDeleteModal: h.remove,
   }),
}));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => ({ currentServer: { provider: h.provider } }),
}));
vi.mock("@/lib/hooks/usePermission", () => ({
   useEffectiveRole: () => h.role,
}));
vi.mock("@/lib/stores/sessionStore", () => ({
   default: (select: (state: { serverId: string }) => unknown) =>
      select({ serverId: "connected-server" }),
}));
vi.mock("./Context", () => ({
   useBucketContext: () => ({ refresh: h.refresh }),
}));
vi.mock("@/lib/utils/s3/presign", () => ({
   getDownloadUrl: vi.fn(),
   saveFromUrl: vi.fn(),
}));
vi.mock("@/lib/utils/toast", () => ({ toastError: vi.fn() }));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: h.error },
}));

beforeEach(() => vi.clearAllMocks());

describe.each([Provider.S3, Provider.R2, Provider.Other])(
   "object commands on %s",
   (provider) => {
      it("exposes download, rename, and deletion to an editor", () => {
         h.provider = provider;
         h.role = Role.EDITOR;
         const commands = useObjectCommands("backups");
         expect(commands.can).toEqual({
            download: true,
            rename: true,
            delete: true,
         });
         commands.rename("old.txt", '"reviewed"');
         commands.remove([{ key: "old.txt", expectedETag: '"reviewed"' }]);
         expect(h.rename).toHaveBeenCalledWith(
            expect.objectContaining({
               serverId: "connected-server",
               bucketName: "backups",
               objectKey: "old.txt",
               expectedETag: '"reviewed"',
            })
         );
         expect(h.remove).toHaveBeenCalledWith(
            expect.objectContaining({
               serverId: "connected-server",
               bucketName: "backups",
            })
         );
      });

      it("preserves viewer restrictions regardless of storage provider", () => {
         h.provider = provider;
         h.role = Role.VIEWER;
         expect(useObjectCommands("backups").can).toEqual({
            download: true,
            rename: false,
            delete: false,
         });
      });

      it.each([null, "*", '"*"', 'W/"old"', ""])(
         "does not open a rename dialog without a valid observed ETag: %s",
         (expectedETag) => {
            h.provider = provider;
            h.role = Role.EDITOR;
            useObjectCommands("backups").rename("old.txt", expectedETag);
            expect(h.rename).not.toHaveBeenCalled();
            expect(h.error).toHaveBeenCalledWith(
               expect.stringContaining("Refresh and review")
            );
         }
      );
   }
);
