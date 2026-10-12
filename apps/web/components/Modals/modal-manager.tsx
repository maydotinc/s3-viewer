import { useModalActions, useModalState } from "@/lib/contexts/modal-context";
import type { ModalProps, ModalType } from "@/lib/contexts/modal-props";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const loading = () => (
   <div
      data-backdrop=""
      className="fixed inset-0 z-50 flex items-center justify-center bg-viewerblack/40"
   >
      <Spinner size="lg" label="Loading" />
   </div>
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
