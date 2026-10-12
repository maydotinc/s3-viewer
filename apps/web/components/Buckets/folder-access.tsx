import Callout from "@/components/callout";
import { GridErrorState } from "@/components/DataGrid/overlays";
import { RetryButton, type RetryProps } from "@/components/status-message";
import {
   DOT_SEGMENTS,
   accessNotice,
   folderAccessAt,
} from "@/lib/utils/folder-access";
import { folderHref, segmentsFromKey } from "@/lib/utils/s3/paths";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Folder, FolderLock } from "lucide-react";
import Link from "next/link";
import { useBucketContext } from "./Context";

const FolderLinks = ({
   bucketName,
   folders,
   className,
}: {
   bucketName: string;
   folders: readonly string[];
   className?: string;
}) => (
   <ul className={cn("flex min-w-0 max-w-full flex-wrap gap-1.5", className)}>
      {folders.map((folder) => (
         <li key={folder} className="min-w-0 max-w-full">
            <Link
               href={folderHref(bucketName, segmentsFromKey(folder))}
               title={folder}
               className="flex max-w-full items-center gap-1.5 rounded-md border border-viewerborder bg-viewerwhite px-2 py-1 text-xs text-viewerblack outline-none transition-colors hover:text-viewerblue focus-visible:border-viewerblue"
            >
               <Folder aria-hidden="true" className="size-3.5 shrink-0" />
               <span className="min-w-0 truncate">{folder}</span>
            </Link>
         </li>
      ))}
   </ul>
);

const FolderAccessNotice = () => {
   const { bucketName, prefix, reach, awaitingReach } = useBucketContext();
   if (awaitingReach)
      return (
         <Skeleton className="h-24 shrink-0 rounded-none border-b border-viewerborder" />
      );
   if (!reach?.folders || folderAccessAt(reach, prefix) !== "leading")
      return null;
   const { title, detail, folders } = accessNotice(reach.folders, prefix);
   return (
      <Callout className="shrink-0 rounded-none border-b border-viewerborder">
         <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-medium text-viewerblack">{title}</p>
            <p>{detail}</p>
         </div>
         <FolderLinks bucketName={bucketName} folders={folders} />
      </Callout>
   );
};

const NoFolderAccess = ({
   bucketName,
   folders,
   target = "folder",
   onRetry,
   retrying,
}: {
   bucketName: string;
   folders: readonly string[];
   target?: "folder" | "file";
} & Partial<RetryProps>) => (
   <GridErrorState
      icon={FolderLock}
      tone="neutral"
      title={`You don't have access to this ${target}`}
      detail={`Your access to ${bucketName} is limited to ${folders.length === 1 ? "this folder" : "these folders"}:`}
   >
      <FolderLinks
         bucketName={bucketName}
         folders={folders}
         className="w-full justify-center"
      />
      {onRetry && <RetryButton onRetry={onRetry} retrying={retrying} />}
   </GridErrorState>
);

const DottedPath = ({ target = "folder" }: { target?: "folder" | "file" }) => (
   <GridErrorState
      icon={FolderLock}
      tone="neutral"
      title={`This ${target} can't be opened`}
      detail={DOT_SEGMENTS}
   />
);

export { DottedPath, FolderAccessNotice, NoFolderAccess };
