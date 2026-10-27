import { useModalActions, useModalState } from "@/lib/contexts/modal-context";
import type { ModalProps, ModalType } from "@/lib/contexts/modal-props";
import {
   DIALOG_CONTENT,
   DIALOG_OVERLAY,
} from "@s3-viewer/ui/components/dialog";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useUserId } from "@/lib/stores/session-store";
import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentType } from "react";

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

type Loader<P> = () => Promise<{ default: ComponentType<P> }>;
type Preloadable = { preload: () => Promise<unknown> };

// the static `import()` string inside each arrow is what lets next split a chunk per modal.
// a preloaded module renders directly: next/dynamic would still show the placeholder for a tick.
const lazyModal = <P extends object>(loader: Loader<P>) => {
   let loaded: ComponentType<P> | null = null;
   let pending: Promise<unknown> | null = null;
   const Lazy = dynamic(loader, { ssr: false, loading });
   const Modal = (props: P) => {
      // chosen once per open, so a chunk arriving mid-session can't remount a dialog in use
      const [Impl] = useState<ComponentType<P>>(() => loaded ?? Lazy);
      return <Impl {...props} />;
   };
   const preload = () =>
      (pending ??= loader().then((module) => {
         loaded = module.default;
      }));
   return Object.assign(Modal, { preload });
};

const MODALS: {
   [K in ModalType]: ComponentType<ModalProps<K>> & Preloadable;
} = {
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

const preloadModals = () => {
   for (const modal of Object.values(MODALS)) void modal.preload();
};

// a signed-in page fetches every modal chunk while idle, so the first open is instant instead of placeholder -> dialog
const usePreloadModals = (enabled: boolean) => {
   useEffect(() => {
      if (!enabled) return;
      if (typeof requestIdleCallback !== "function") {
         const id = setTimeout(preloadModals, 1000);
         return () => clearTimeout(id);
      }
      const id = requestIdleCallback(preloadModals);
      return () => cancelIdleCallback(id);
   }, [enabled]);
};

const ModalManager = () => {
   const modals = useModalState();
   const { closeModal } = useModalActions();
   usePreloadModals(Boolean(useUserId()));
   return (Object.keys(MODALS) as ModalType[]).map((type) => {
      const props = modals[type];
      if (!props) return null;
      const Modal = MODALS[type] as ComponentType<ModalProps<typeof type>>;
      return <Modal key={type} {...props} onClose={() => closeModal(type)} />;
   });
};

export default ModalManager;
