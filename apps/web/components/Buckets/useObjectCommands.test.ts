import { beforeEach, describe, expect, it, vi } from "vitest";
import { Provider, Role } from "@s3-viewer/types";
import useObjectCommands from "./useObjectCommands";

const h = vi.hoisted(() => ({
   provider: "S3",
   role: "EDITOR",
   renameAvailable: false,
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
   default: () => ({
      currentServer: {
         provider: h.provider,
         capabilities: {
            upload: true,
            replace: h.provider === "R2",
            rename: h.renameAvailable,
            delete: h.provider === "S3" || h.provider === "R2",
            notice: null,
         },
      },
   }),
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

beforeEach(() => {
   vi.clearAllMocks();
   h.renameAvailable = false;
});

describe.each([Provider.S3, Provider.R2, Provider.Other])(
   "object commands on %s",
   (provider) => {
      it("intersects editor permissions with provider capabilities", () => {
         h.provider = provider;
         h.role = Role.EDITOR;
         const commands = useObjectCommands("backups");
         expect(commands.can).toEqual({
            download: true,
            rename: false,
            delete: provider === Provider.S3 || provider === Provider.R2,
         });
         commands.rename("old.txt", '"reviewed"');
         expect(h.rename).not.toHaveBeenCalled();
         commands.remove([{ key: "old.txt", expectedETag: '"reviewed"' }]);
         if (provider === Provider.Other) {
            expect(h.rename).not.toHaveBeenCalled();
            expect(h.remove).not.toHaveBeenCalled();
            return;
         }
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
         useObjectCommands("backups").rename("old.txt", '"reviewed"');
         useObjectCommands("backups").remove([
            { key: "old.txt", expectedETag: '"reviewed"' },
         ]);
         expect(h.rename).not.toHaveBeenCalled();
         expect(h.remove).not.toHaveBeenCalled();
      });

      it.each([null, "*", '"*"', 'W/"old"', ""])(
         "does not open a rename dialog without a valid observed ETag: %s",
         (expectedETag) => {
            // The UI must still enforce reviewed identity if a future provider
            // advertises atomic rename support.
            h.renameAvailable = true;
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
