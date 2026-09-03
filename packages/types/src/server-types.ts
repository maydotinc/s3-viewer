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
};

type ServerInfo = {
   id: string;
   name: string;
   userRole: Role;
   provider: Provider;
};

type BucketAccessEntry = {
   bucketName: string;
   role: Role;
};

type ServerUser = {
   id: string;
   name: string;
   email: string;
   image: string | null;
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

export { Provider, Role };
export type {
   ApiError,
   BucketAccessEntry,
   BucketCheck,
   EstablishResult,
   GrantableRole,
   SendInviteResult,
   ServerCredentials,
   ServerInfo,
   ServerInvite,
   ServerUser,
};
