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

type ServerCredentials = {
   endpoint: string;
   region: string;
   accessKey: string;
   secretKey: string;
   sessionToken?: string;
};

type ServerInfo = {
   id: string;
   name: string;
   userRole: Role;
   provider: Provider;
   /** Additive for older clients; missing capabilities must disable mutations. */
   capabilities?: StorageCapabilities;
};

type StorageCapabilities = {
   upload: boolean;
   replace: boolean;
   rename: boolean;
   delete: boolean;
   notice: string | null;
};

type BucketAccessEntry = {
   bucketName: string;
   role: Role;
};

type ServerUser = {
   id: string;
   name: string;
   email: string;
   role: Role;
   bucketAccess: BucketAccessEntry[];
};

type ServerInvite = {
   id: string;
   role: Role;
   expiresAt: string;
   email: string;
   server: { id: string; name: string };
   invitedBy: { name: string; email: string };
   bucketAccess: BucketAccessEntry[];
};

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

type SendInviteResult = {
   invites: ServerInvite[];
   alreadyMembers: string[];
};

type OwnedServerSummary = {
   id: string;
   name: string;
   /** members other than the owner */
   memberCount: number;
   pendingInviteCount: number;
};

type AccountSummary = {
   user: { id: string; email: string };
   ownedServers: OwnedServerSummary[];
   /** servers the user belongs to but does not own */
   memberships: number;
   /** live invites the user sent on servers they do not own */
   sentInvites: number;
   /** live invites addressed to the user's email */
   receivedInvites: number;
};

// who may create an account here: `open` to anyone, `domains` to the listed
// email domains, `closed` to nobody. allowedEmailDomains is only meaningful
// in `domains` mode, where the sign-in form lists it
/**
 * `open` anyone, `domains` a listed domain or a live invitation,
 * `invite` a live invitation only, `closed` nobody (existing users only).
 */
type SignUpMode = "open" | "domains" | "invite" | "closed";

/** GET /config: what an install can do, read by the web app at runtime */
type PublicConfig = {
   encryptionPublicKey: string;
   githubLoginEnabled: boolean;
   emailEnabled: boolean;
   signUpMode: SignUpMode;
   allowedEmailDomains: string[];
};

export { Provider, Role };
export type {
   AccountSummary,
   ApiError,
   BucketAccessEntry,
   BucketCheck,
   EstablishResult,
   GrantableRole,
   OwnedServerSummary,
   PublicConfig,
   SendInviteResult,
   ServerCredentials,
   ServerInfo,
   StorageCapabilities,
   ServerInvite,
   ServerUser,
   SignUpMode,
};
