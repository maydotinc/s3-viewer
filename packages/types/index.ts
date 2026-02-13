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

//==== S3 TYPES ====//
type S3Bucket = {
   Name: string;
   CreationDate: string;
   userRole?: Role;
};

type S3Object = {
   Key: string;
   LastModified: string | null;
   Size: number | null;
};

type S3ObjectMetadata = {
   contentType?: string;
   contentLength?: number;
   lastModified?: Date;
   storageClass?: string;
};

type S3ObjectPreviewResponse = {
   url: string;
   contentType: string;
};

export { Provider, Role };
export type {
   BucketAccessEntry,
   S3Bucket,
   S3Object,
   S3ObjectMetadata,
   S3ObjectPreviewResponse,
   ServerCredentials,
   ServerInfo,
   ServerInvite,
   ServerUser,
};
