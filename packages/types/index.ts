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
   storageUsed: number;
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
   BucketRegion: string;
   CreationDate: string;
   Name: string;
};

type S3Object = {
   ChecksumAlgorithm: string;
   ChecksumType: string;
   ETag: string;
   Key: string;
   LastModified: string;
   Size: number;
   StorageClass: string;
};

type Bucket = {
   Name: string;
   CreationDate: string | Date;
};

type Object = {
   Key: string;
   LastModified: string | Date;
   Size: number;
};

type BucketFolder = Bucket & {
   Files: number;
   Folders: number;
   TotalSize: number;
};

export { Role };
export type {
   Bucket,
   BucketFolder,
   Object,
   S3Bucket,
   S3Object,
   ServerCredentials,
   ServerInfo,
   ServerInvite,
   ServerUser,
};
