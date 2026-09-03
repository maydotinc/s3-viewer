import { Role } from "./server-types";

type S3Bucket = {
   name: string;
   creationDate: string | null;
   userRole: Role;
};

type S3Object = {
   key: string;
   isFolder: boolean;
   lastModified: string | null;
   size: number | null;
};

type S3ObjectListPage = {
   objects: S3Object[];
   nextToken: string | null;
};

type S3ObjectMetadata = {
   contentType: string;
   contentLength: number;
   lastModified: string | null;
   storageClass: string | null;
   eTag: string | null;
};

type S3PresignedUrl = {
   url: string;
   expiresAt: string;
};

type S3ObjectPreview = S3PresignedUrl & {
   contentType: string;
   contentLength: number;
};

type S3ObjectUploaded = { key: string; size: number; eTag: string | null };
type S3DeleteResult = {
   deleted: string[];
   failed: { key: string; message: string }[];
};
type S3KeysPage = { keys: string[]; nextToken: string | null };
type S3ObjectsExist = { existing: string[] };

export type {
   S3Bucket,
   S3DeleteResult,
   S3Object,
   S3ObjectListPage,
   S3ObjectMetadata,
   S3ObjectPreview,
   S3KeysPage,
   S3ObjectUploaded,
   S3ObjectsExist,
   S3PresignedUrl,
};
