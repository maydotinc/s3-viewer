//==== SERVER TYPES ====//
enum Role {
   OWNER = "OWNER",
   ADMIN = "ADMIN",
   EDITOR = "EDITOR",
   VIEWER = "VIEWER",
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

export { Role };
export type {
   S3Bucket,
   S3Object,
   ServerCredentials,
   ServerInfo,
   ServerInvite,
   ServerUser,
};
