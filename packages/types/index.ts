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
};

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

export type { Bucket, BucketFolder, Object, S3Bucket, S3Object, ServerCredentials, ServerInfo };
