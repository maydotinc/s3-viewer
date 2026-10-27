import type { TransferSource } from "@/lib/hooks/mutations/object/useTransferObjects";
import type { S3DeleteTarget } from "@s3-viewer/shared";

type BulkRenameSource = { folderKey: string } | { objects: S3DeleteTarget[] };

type MoveSource =
   | { folderKey: string }
   | { objects: S3DeleteTarget[]; prefix: string };

export type { BulkRenameSource, MoveSource, TransferSource };
