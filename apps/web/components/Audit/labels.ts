import { formatBytes, pluralize } from "@/lib/utils/format";
import { bucketDetailText } from "./bucket-detail";
import { Permission, ROLE_LABELS } from "@s3-viewer/permissions";
import {
   AuditLevel,
   type AuditAction,
   type AuditDetail,
   type AuditLogEntry,
   type AuditVerification,
} from "@s3-viewer/types";

const ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
   "server.create": "Connected the server",
   "server.rename": "Renamed the server",
   "server.delete": "Deleted the server",
   "server.leave": "Left the server",
   "credentials.update": "Updated the credentials",
   "member.role_change": "Changed a member's role",
   "member.remove": "Removed a member",
   "invite.send": "Sent an invite",
   "invite.revoke": "Revoked an invite",
   "invite.accept": "Accepted an invite",
   "invite.reject": "Rejected an invite",
   "bucket.create": "Created a bucket",
   "bucket.remove": "Removed a bucket",
   "object.list": "Browsed a folder",
   "object.view": "Viewed an object",
   "object.download": "Downloaded an object",
   "object.upload": "Uploaded an object",
   "object.delete": "Deleted an object",
   "object.rename": "Renamed an object",
   "object.move": "Moved an object",
   "object.copy": "Copied an object",
   "folder.create": "Created a folder",
   "object.settings": "Changed an object's settings",
   "object.transfer": "Copied an object to another bucket",
   "object.archive": "Downloaded a zip archive",
   "object.multipart_abort": "Aborted an incomplete upload",
   "audit.settings_change": "Changed audit log settings",
   "audit.view": "Viewed the audit log",
   "audit.export": "Exported the audit log",
   "audit.prune": "Removed expired audit log entries",
   "access.denied": "Was refused an action",
};

type ActionFamily =
   | "object"
   | "folder"
   | "bucket"
   | "member"
   | "invite"
   | "server"
   | "credentials"
   | "audit"
   | "access";

const ACTION_FAMILY_LABELS: Readonly<Record<ActionFamily, string>> = {
   object: "Objects",
   folder: "Folders",
   bucket: "Buckets",
   member: "Members",
   invite: "Invites",
   server: "Server",
   credentials: "Credentials",
   audit: "Audit log",
   access: "Refused actions",
};

const RETENTION_OPTIONS = [0, 90, 180, 365, 730, 3650] as const;

type Option = { value: string; label: string; description?: string };

const LEVEL_LABELS: Readonly<Record<AuditLevel, string>> = {
   [AuditLevel.ALL]: "Everything",
   [AuditLevel.CHANGES]: "Changes and downloads",
};

const LEVEL_OPTIONS: readonly Option[] = [
   {
      value: AuditLevel.ALL,
      label: LEVEL_LABELS[AuditLevel.ALL],
      description: "Browsing and previews too",
   },
   {
      value: AuditLevel.CHANGES,
      label: LEVEL_LABELS[AuditLevel.CHANGES],
      description: "Skips browsing and previews",
   },
];

const PERMISSION_WORDS: Readonly<
   Record<Permission | "audit.view" | "audit.manage", string>
> = {
   [Permission.DELETE_SERVER]: "delete the server",
   [Permission.UPDATE_CREDENTIALS]: "update the credentials",
   [Permission.RENAME_SERVER]: "rename the server",
   [Permission.MANAGE_MEMBERS]: "manage members",
   [Permission.LIST_BUCKETS]: "list buckets",
   [Permission.CREATE_BUCKET]: "create a bucket",
   [Permission.DELETE_BUCKET]: "remove a bucket from this server",
   [Permission.LIST_OBJECTS]: "browse objects",
   [Permission.DOWNLOAD_OBJECT]: "download objects",
   [Permission.UPLOAD_OBJECT]: "upload objects",
   [Permission.DELETE_OBJECT]: "delete objects",
   "audit.view": "view the audit log",
   "audit.manage": "change audit log settings",
};

const DENIAL_REASONS: Readonly<Record<string, string>> = {
   forbidden: "role too low",
   bucket: "no access to that bucket",
   member: "can't manage that member",
   audit: "audit log not shared with them",
   folder: "outside their folders",
   path: "path with . or .. segments",
};

const INDIRECT_REASONS: Readonly<Record<string, string>> = {
   sender_authority: "sender can no longer grant this access",
   account_deleted: "account deleted",
};

const count = new Intl.NumberFormat();
const seq = (n: number) => `#${count.format(n)}`;

const verificationMessage = ({
   ok,
   rows,
   firstSeq,
   lastSeq,
   brokenAt,
   nextFromSeq,
}: AuditVerification): string => {
   if (!ok)
      return `Chain broken${brokenAt === null ? "" : ` at record ${seq(brokenAt)}`}`;
   const records = `${count.format(rows)} ${rows === 1 ? "record" : "records"}`;
   if (nextFromSeq !== null)
      return `Verified ${records} so far. Continue to check the remaining records.`;
   if (firstSeq === null || lastSeq === null) return "Chain intact: no records";
   return `Chain intact: ${records} (${seq(firstSeq)}–${seq(lastSeq)})`;
};

const retentionLabel = (days: number): string =>
   days === 0
      ? "Instance default"
      : days % 365 === 0
        ? `${days / 365} ${days === 365 ? "year" : "years"}`
        : `${days} days`;

const lookup = (
   table: Readonly<Record<string, string>>,
   key: AuditDetail[string] | undefined
): string | null => (typeof key === "string" ? (table[key] ?? null) : null);

const joined = (parts: readonly (string | null)[], sep: string): string =>
   parts.filter((part): part is string => Boolean(part)).join(sep);

const targetOf = ({ bucket, target }: AuditLogEntry): string | null =>
   joined([bucket, target === "/" ? null : target], " / ") || null;

const metaOf = ({ action, detail }: AuditLogEntry): string | null => {
   if (!detail) return null;
   switch (action) {
      case "object.view":
      case "object.upload":
         return (
            joined(
               [
                  typeof detail.size === "number"
                     ? formatBytes(detail.size)
                     : null,
                  typeof detail.contentType === "string"
                     ? detail.contentType
                     : null,
                  action === "object.upload" && detail.replaced === true
                     ? "replaced"
                     : null,
               ],
               " · "
            ) || null
         );
      case "bucket.create":
         return typeof detail.clearedGrants === "number"
            ? `cleared ${pluralize(detail.clearedGrants, "earlier grant")}`
            : null;
      case "object.delete":
         return typeof detail.count === "number" && detail.count > 1
            ? `one of ${detail.count} objects`
            : null;
      case "object.rename":
      case "object.move":
         return typeof detail.to === "string" ? `→ ${detail.to}` : null;
      case "object.copy":
         return (
            joined(
               [
                  typeof detail.to === "string" ? `→ ${detail.to}` : null,
                  typeof detail.size === "number"
                     ? formatBytes(detail.size)
                     : null,
               ],
               " · "
            ) || null
         );
      case "server.rename":
         return typeof detail.from === "string" ? `was ${detail.from}` : null;
      case "server.create":
      case "server.delete":
         return typeof detail.name === "string" ? detail.name : null;
      case "audit.prune":
         return typeof detail.removed === "number"
            ? `${detail.removed} ${detail.removed === 1 ? "entry" : "entries"}`
            : null;
      case "server.leave":
      case "invite.revoke":
         return lookup(INDIRECT_REASONS, detail.reason);
      case "member.role_change":
      case "invite.send":
      case "invite.accept": {
         const role = lookup(ROLE_LABELS, detail.role);
         return (
            joined(
               [
                  role ? `${role} role` : null,
                  typeof detail.buckets === "string"
                     ? bucketDetailText(detail.buckets)
                     : null,
               ],
               " · "
            ) || null
         );
      }
      case "audit.settings_change":
         return joined(
            [
               detail.enabled === true ? "on" : "off",
               lookup(LEVEL_LABELS, detail.level)?.toLowerCase() ?? null,
               typeof detail.retentionDays === "number"
                  ? `keep for ${retentionLabel(detail.retentionDays).toLowerCase()}`
                  : null,
            ],
            " · "
         );
      case "access.denied": {
         const words = lookup(PERMISSION_WORDS, detail.permission);
         return (
            joined(
               [
                  words ? `tried to ${words}` : null,
                  lookup(DENIAL_REASONS, detail.reason),
                  detail.unverifiedOrigin === true
                     ? "request origin not verified"
                     : null,
               ],
               " · "
            ) || null
         );
      }
      default:
         return null;
   }
};

export {
   ACTION_FAMILY_LABELS,
   ACTION_LABELS,
   LEVEL_OPTIONS,
   RETENTION_OPTIONS,
   metaOf,
   retentionLabel,
   targetOf,
   verificationMessage,
};
export type { Option };
