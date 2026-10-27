import type { Role } from "./server-types";

const AUDIT_ACTIONS = [
   "server.create",
   "server.rename",
   "server.delete",
   "server.leave",
   "credentials.update",
   "member.role_change",
   "member.remove",
   "invite.send",
   "invite.revoke",
   "invite.accept",
   "invite.reject",
   "bucket.create",
   "bucket.remove",
   "object.list",
   "object.view",
   "object.download",
   "object.upload",
   "object.delete",
   "object.rename",
   "object.move",
   "object.copy",
   "folder.create",
   "object.settings",
   "object.transfer",
   "object.archive",
   "object.multipart_abort",
   "audit.settings_change",
   "audit.view",
   "audit.export",
   "audit.prune",
   "access.denied",
] as const;

type AuditAction = (typeof AUDIT_ACTIONS)[number];

const AuditLevel = {
   ALL: "ALL",
   CHANGES: "CHANGES",
} as const;
type AuditLevel = (typeof AuditLevel)[keyof typeof AuditLevel];

type AuditDetail = Record<string, string | number | boolean | null>;

type AuditEntry = {
   action: AuditAction;
   bucket?: string | null;
   target?: string | null;
   detail?: AuditDetail | null;
};

type AuditLogEntry = {
   id: string;
   action: AuditAction;
   actorId: string;
   actorEmail: string;
   bucket: string | null;
   target: string | null;
   detail: AuditDetail | null;
   createdAt: string;
};

type AuditLogPage = { entries: AuditLogEntry[]; nextCursor: string | null };

type AuditManageRole = typeof Role.OWNER | typeof Role.ADMIN;

type AuditSettings = {
   enabled: boolean;
   viewRole: Role;
   manageRole: AuditManageRole;
   /** 0 defers to the instance-wide AUDIT_RETENTION_DAYS. */
   retentionDays: number;
   level: AuditLevel;
};

type AuditVerification = {
   ok: boolean;
   rows: number;
   firstSeq: number | null;
   lastSeq: number | null;
   brokenAt: number | null;
   truncated: boolean;
   anchorSeq: number | null;
   nextFromSeq: number | null;
};

type AuditAccess = {
   enabled: boolean;
   canView: boolean;
   canManage: boolean;
   canVerify: boolean;
};

export { AUDIT_ACTIONS, AuditLevel };
export type {
   AuditAccess,
   AuditAction,
   AuditDetail,
   AuditEntry,
   AuditLogEntry,
   AuditLogPage,
   AuditManageRole,
   AuditSettings,
   AuditVerification,
};
