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
   | "account.delete";

type AuditEntry = {
   action: AuditAction;
   actorId?: string | null;
   serverId?: string | null;
   target?: string | null;
};

export type { AuditAction, AuditEntry };
