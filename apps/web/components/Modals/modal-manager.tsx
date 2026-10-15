import { useModalActions, useModalState } from "@/lib/contexts/modal-context";
import type { ModalProps, ModalType } from "@/lib/contexts/modal-props";
import {
   DIALOG_CONTENT,
   DIALOG_OVERLAY,
} from "@s3-viewer/ui/components/dialog";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// a dialog-shaped card, so the first open of a modal doesn't go spinner -> dialog
const loading = () => (
   <>
      <div data-backdrop="" className={DIALOG_OVERLAY} />
      <div
         aria-busy="true"
         className={cn(DIALOG_CONTENT, "gap-3 px-4 pt-5 pb-6 sm:px-6")}
      >
         <span className="sr-only">Loading</span>
         <Skeleton className="h-6 w-40" />
         <Skeleton className="h-4 w-full" />
         <Skeleton className="h-4 w-2/3" />
      </div>
   </>
);

// the static `import()` string inside each arrow is what lets next split a chunk per modal.
const lazyModal = <P,>(loader: () => Promise<{ default: ComponentType<P> }>) =>
   dynamic(loader, { ssr: false, loading });

const MODALS: { [K in ModalType]: ComponentType<ModalProps<K>> } = {
   connect: lazyModal(() => import("./ConnectModal")),
   createBucket: lazyModal(() => import("./CreateBucketModal")),
   confirmDelete: lazyModal(() => import("./ConfirmDeleteModal")),
   rename: lazyModal(() => import("./RenameModal")),
   renameObject: lazyModal(() => import("./RenameObjectModal")),
   copyObject: lazyModal(() => import("./CopyObjectModal")),
   createFolder: lazyModal(() => import("./CreateFolderModal")),
   moveObjects: lazyModal(() => import("./MoveObjectsModal")),
   transferObjects: lazyModal(() => import("./TransferObjectsModal")),
   bulkRename: lazyModal(() => import("./BulkRenameModal")),
   incompleteUploads: lazyModal(() => import("./IncompleteUploadsModal")),
   objectSettings: lazyModal(() => import("./ObjectSettingsModal")),
   disconnect: lazyModal(() => import("./DisconnectModal")),
   updateCredentials: lazyModal(() => import("./UpdateCredentialsModal")),
};

const ModalManager = () => {
   const modals = useModalState();
   const { closeModal } = useModalActions();
   return (Object.keys(MODALS) as ModalType[]).map((type) => {
      const props = modals[type];
      if (!props) return null;
      const Modal = MODALS[type] as ComponentType<ModalProps<typeof type>>;
      return <Modal key={type} {...props} onClose={() => closeModal(type)} />;
   });
};

export default ModalManager;
