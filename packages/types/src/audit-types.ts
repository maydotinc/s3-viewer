type AuditAction =
   | "server.create"
   | "server.rename"
   | "server.delete"
   | "server.leave"
   | "credentials.update"
   | "member.role_change"
   | "member.remove"
   | "invite.send"
   | "invite.revoke"
   | "invite.accept"
   | "invite.reject"
   | "bucket.create"
   | "bucket.remove"
   | "object.delete"
   | "object.rename"
   | "account.delete"
   | "account.verify"
   | "auth.sign_in"
   | "auth.sign_in_failed"
   | "auth.sign_up"
   | "auth.sign_up_refused"
   | "auth.sign_out"
   | "auth.password_change"
   | "auth.password_reset"
   | "auth.password_set"
   | "auth.sessions_revoked";

type AuditEntry = {
   action: AuditAction;
   actorId?: string | null;
   serverId?: string | null;
   target?: string | null;
};

// actorEmail/actorName are resolved from the user table when the actor still
// exists; a deleted account leaves the row with an id nothing resolves to
type AuditLogEntry = {
   id: string;
   action: AuditAction;
   actorId: string | null;
   actorEmail: string | null;
   actorName: string | null;
   target: string | null;
   createdAt: string;
};

type AuditLogPage = { entries: AuditLogEntry[]; nextCursor: string | null };

export type { AuditAction, AuditEntry, AuditLogEntry, AuditLogPage };
