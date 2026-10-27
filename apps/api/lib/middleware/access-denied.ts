import { ApiHttpError } from "@/lib/http";
import type { AuditScope } from "@/lib/services/servers";
import {
   DOT_SEGMENTS_MESSAGE,
   ErrorCode,
   type AuditEntry,
   type FolderScope,
} from "@s3-viewer/shared";

const FORBIDDEN = "You don't have permission to do that";

type DenialReason =
   | "forbidden"
   | "bucket"
   | "member"
   | "audit"
   | "folder"
   | "path";
type DenialScope = { serverId: string; actorId: string; audit: AuditScope };
type Denial = DenialScope & {
   entry: AuditEntry & {
      bucket: string | null;
      detail: { permission: string; reason: DenialReason };
   };
};

class AccessDeniedError extends ApiHttpError {
   constructor(
      status: number,
      message: string,
      public readonly denial: Denial,
      code?: ErrorCode
   ) {
      super(status, message, code);
      this.name = "AccessDeniedError";
   }
}

const denied = (
   status: number,
   message: string,
   scope: DenialScope,
   permission: string,
   reason: DenialReason,
   bucket: string | null = null
): AccessDeniedError =>
   new AccessDeniedError(status, message, {
      ...scope,
      entry: {
         action: "access.denied",
         bucket,
         detail: { permission, reason },
      },
   });

const NAMED_FOLDERS = 3;

const limitedTo = (folders: readonly string[]): string => {
   if (folders.length === 1) {
      return `Your access to this bucket is limited to ${folders[0]}`;
   }
   const named = folders.slice(0, NAMED_FOLDERS).join(", ");
   const more = folders.length - NAMED_FOLDERS;
   return `Your access to this bucket is limited to these folders: ${named}${
      more > 0 ? ` and ${more} more` : ""
   }`;
};

const folderDenial = (
   scope: DenialScope,
   folders: FolderScope,
   bucketName: string,
   permission: string,
   path: string,
   reason: "folder" | "path"
): AccessDeniedError =>
   new AccessDeniedError(
      403,
      reason === "path" ? DOT_SEGMENTS_MESSAGE : limitedTo(folders ?? []),
      {
         ...scope,
         entry: {
            action: "access.denied",
            bucket: bucketName,
            target: path,
            detail: { permission, reason },
         },
      },
      ErrorCode.FOLDER_ACCESS
   );

export { AccessDeniedError, FORBIDDEN, denied, folderDenial };
export type { Denial, DenialReason, DenialScope };
