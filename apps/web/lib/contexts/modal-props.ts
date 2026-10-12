import type {
   BulkRenameSource,
   MoveSource,
   TransferSource,
} from "./modal-sources";
import type { BucketTarget } from "@/lib/types";
import type { ServerInfo, S3DeleteTarget } from "@s3-viewer/types";

type ModalPropsMap = {
   connect: Record<never, never>;
   createBucket: Record<never, never>;
   confirmDelete: BucketTarget & {
      objects: S3DeleteTarget[];
      onDeleteSuccess?: () => void;
   };
   rename: { server: ServerInfo };
   renameObject: BucketTarget & {
      objectKey: string;
      expectedETag: string;
      onRenameSuccess?: (newObjectKey: string) => void;
   };
   copyObject: BucketTarget & {
      objectKey: string;
      expectedETag: string;
      onCopySuccess?: (newObjectKey: string) => void;
   };
   createFolder: BucketTarget & {
      prefix: string;
      onCreateSuccess?: (folderKey: string) => void;
   };
   moveObjects: BucketTarget & {
      source: MoveSource;
      onMoved?: () => void;
      onMoveComplete?: (destination: string) => void;
   };
   transferObjects: BucketTarget & {
      source: TransferSource;
      onTransferred?: () => void;
   };
   bulkRename: BucketTarget & {
      source: BulkRenameSource;
      onRenamed?: () => void;
   };
   incompleteUploads: BucketTarget & {
      prefix: string;
      onAborted?: () => void;
   };
   objectSettings: BucketTarget & {
      objectKey: string;
      expectedETag: string;
      onSaved?: () => void;
   };
   disconnect: { server: ServerInfo };
   updateCredentials: { server: ServerInfo; onUpdated?: () => void };
};

type ModalType = keyof ModalPropsMap;
type ScopedModalType = {
   [K in ModalType]: ModalPropsMap[K] extends BucketTarget ? K : never;
}[ModalType];

type ModalProps<K extends ModalType> = ModalPropsMap[K] & {
   onClose: () => void;
};

export type { ModalProps, ModalPropsMap, ModalType, ScopedModalType };
