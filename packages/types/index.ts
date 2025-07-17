//==== SERVER TYPES ====//
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

type ServerUser = {
   id: string;
   name: string;
   email: string;
   image: string;
   role: Role;
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
};

//==== S3 TYPES ====//
type S3Bucket = {
   Name: string;
   CreationDate: string;
};

type S3Object = {
   Key: string;
   LastModified: string | null;
   Size: number | null;
};

export { Provider, Role };
export type {
   S3Bucket,
   S3Object,
   ServerCredentials,
   ServerInfo,
   ServerInvite,
   ServerUser,
};
