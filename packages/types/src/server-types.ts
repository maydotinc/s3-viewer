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
  image: string;
  role: Role;
  bucketAccess: BucketAccessEntry[];
};

type ServerInvite = {
  id: string;
  role: Role;
  expiresAt: string;
  email: string;
  server: {
    name: string;
  };
  invitedBy: {
    name: string;
    email: string;
  };
  bucketAccess: BucketAccessEntry[];
};

export { Role, Provider };
export type { ServerCredentials, ServerInfo, BucketAccessEntry, ServerUser, ServerInvite };