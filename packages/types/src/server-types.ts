import type { AuditAccess } from "./audit-types";

enum Role {
   OWNER = "OWNER",
   ADMIN = "ADMIN",
   EDITOR = "EDITOR",
   VIEWER = "VIEWER",
}

enum Provider {
   S3 = "S3",
   R2 = "R2",
   Other = "Other",
}

type GrantableRole = Exclude<Role, Role.OWNER>;

type ServerInfo = {
   id: string;
   name: string;
   userRole: Role;
   provider: Provider;
   capabilities: StorageCapabilities;
   canCreateBucket: boolean;
   audit: AuditAccess;
};

type ServerPage = { servers: ServerInfo[]; nextCursor: string | null };

type StorageCapabilities = {
   upload: boolean;
   replace: boolean;
   rename: boolean;
   delete: boolean;
   deleteProtection: "conditional" | "checked" | null;
   notice: string | null;
};

type BucketAccessEntry = {
   bucketName: string;
   role: Role;
   folders: string[] | null;
};

type ServerUser = {
   id: string;
   name: string;
   email: string;
   role: Role;
   bucketAccess: BucketAccessEntry[];
};

type MemberPage = { members: ServerUser[]; nextCursor: string | null };

type ServerInvite = {
   id: string;
   role: Role;
   expiresAt: string;
   email: string;
   server: { id: string; name: string };
   invitedBy: { name: string; email: string };
   bucketAccess: BucketAccessEntry[];
};

type InvitesResponse = { invites: ServerInvite[] };
type InvitesPage = InvitesResponse & { nextCursor: string | null };

type ApiError = {
   message: string;
   code?: string;
};

type EstablishResult = {
   listBucketsAllowed: boolean;
   bucketCount: number;
   provider: Provider;
};

type BucketCheck = { bucketName: string; accessible: boolean };

/** emailed is false when the invite was saved but no email went out (cooldown, cap or send failure). */
type SentInvite = ServerInvite & { emailed: boolean };

/** one server's outcome in a multi-server invite; `error` is set when that server refused, the others still went through. */
type InviteOutcome = {
   serverId: string;
   invites: SentInvite[];
   alreadyMembers: string[];
   error: string | null;
};

type SendInvitesResult = { outcomes: InviteOutcome[] };

type OwnedServerSummary = {
   id: string;
   name: string;
   memberCount: number;
   pendingInviteCount: number;
};

type AccountSummary = {
   user: { id: string; email: string };
   ownedServers: OwnedServerSummary[];
   memberships: number;
   sentInvites: number;
   receivedInvites: number;
};

const SIGN_UP_MODES = ["open", "domains", "invite", "closed"] as const;

type SignUpMode = (typeof SIGN_UP_MODES)[number];

type PublicConfig = {
   allowInsecureEndpoints: boolean;
   encryptionPublicKey: string;
   githubLoginEnabled: boolean;
   emailEnabled: boolean;
   signUpMode: SignUpMode;
   allowedEmailDomains: string[];
};

export { Provider, Role, SIGN_UP_MODES };
export type {
   AccountSummary,
   ApiError,
   BucketAccessEntry,
   BucketCheck,
   EstablishResult,
   GrantableRole,
   InviteOutcome,
   InvitesPage,
   InvitesResponse,
   MemberPage,
   PublicConfig,
   SendInvitesResult,
   SentInvite,
   ServerInfo,
   ServerPage,
   StorageCapabilities,
   ServerInvite,
   ServerUser,
   SignUpMode,
};
