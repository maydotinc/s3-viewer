import { Role } from "./server-types";

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

export type { S3Bucket, S3Object, S3ObjectMetadata, S3ObjectPreviewResponse };